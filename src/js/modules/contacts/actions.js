'use strict'

const Actions = require('../../lib/actions')


/**
 * All UI related actions for Contacts.
 */
class ContactsActions extends Actions {
    /**
     * Register local events; e.g. events that are triggered
     * from the background and handled by the background.
     */
    _background() {
        this.app.on('sip:starting', (e) => {
            let widgetsData = this.app.store.get('widgets')
            widgetsData.contacts.status = 'connecting'
            this.app.store.set('widgets', widgetsData)
            this.app.emit('contacts.connecting')
        })

        this.app.on('sip:started', (e) => {
            let widgetsData = this.app.store.get('widgets')
            widgetsData.contacts.status = 'connected'
            this.app.store.set('widgets', widgetsData)
            const accountIds = widgetsData.contacts.list.map((c) => c.account_id)
            this.app.sip.updatePresence(accountIds, true)
        })

        this.app.on('sip:failed_to_start', (e) => {
            let widgetsData = this.app.store.get('widgets')
            widgetsData.contacts.status = 'failed_to_start'
            this.app.store.set('widgets', widgetsData)
            this.app.emit('contacts.failed_to_start')
        })

        this.app.on('sip:stopped', (e) => {
            let widgetsData = this.app.store.get('widgets')
            if (widgetsData) {
                widgetsData.contacts.status = 'disconnected'
                this.app.store.set('widgets', widgetsData)
            }
            this.app.emit('contacts.disconnected')
        })
    }


    _popup() {
        let searchQuery = ''
        // Force size for .contact,
        // useful in case of a popout and the list of contacts
        // is larger in size (height) than the viewport.
        function resizeContacts(reset) {
            let pluginWidth = $('.container').outerWidth()
            $('body.expand .contact').css('width', pluginWidth)
        }
        resizeContacts()
        $(window).resize(resizeContacts)

        // Hack in popout to display bottom border.
        this.app.on('widget.open', (data) => {
            if (data.name === 'contacts') {
                $('.contacts .list .contact:visible:last').addClass('last')
            }
        })

        this.app.on('contacts.connecting', (data) => {
            this.app.logger.debug(`${this}contacts.connecting triggered`)
            $('.contacts .connection-icon').hide().filter('.connecting').css('display', 'inline-block')
            $('.contacts .status-icon').removeClass('available unavailable busy ringing shake')
        })

        this.app.on('contacts.failed_to_start', (data) => {
            this.app.logger.debug(`${this}contacts.failed_to_start triggered`)
            $('.contacts .connection-icon').hide().filter('.no-connection').css('display', 'inline-block')
        })

        this.app.on('sip:presence_ready', (data) => {
            this.app.logger.debug(`${this}sip:presence_ready triggered`)
            $('.contacts .connection-icon').hide()
        })

        this.app.on('contacts.disconnected', (data) => {
            this.app.logger.debug(`${this}contacts.disconnected triggered`)
            $('.contacts .connection-icon').hide().filter('.connecting').css('display', 'inline-block')
            $('.contacts .status-icon').removeClass('available unavailable busy ringing shake')
        })

        this.app.on('contacts.sip', (data) => {
            this.app.logger.debug(`${this}contacts.sip triggered`)
            let account_id = data.account_id
            let state = data.state
            $(`#sip${account_id} .status-icon`).removeClass('available unavailable busy ringing shake').addClass(state)
        })

        this.app.on('contacts.reset', (data) => {
            let list = $('.contacts .list')
            list.empty()
            $('.widget.contacts .empty-list').addClass('hide')

            // Reset search.
            searchQuery = ''
            $('.search-form :input').val(searchQuery)
            $('.widget.contacts .contact').removeClass('hide')
        })

        this.app.on('contacts.empty', (data) => {
            $('.widget.contacts .empty-list').removeClass('hide')
            $('.contacts .search-query').attr('disabled', 'disabled')
        })

        // Fill the contact list.
        this.app.on('contacts.fill', (data) => {
            this.app.logger.info(`${this}contacts.fill triggered`)
            let contacts = data.contacts
            $('.widget.contacts .empty-list').addClass('hide')
            $('.contacts .search-query').removeAttr('disabled')

            // Clear list.
            let list = $('.contacts .list')
            list.empty()

            // Fill list.
            let template = $('.contacts .template .contact')
            $.each(contacts, function(index, contact) {
                let listItem = template.clone()
                listItem.attr('id', 'sip' + contact.account_id)
                listItem.find('.name').text(contact.description)
                listItem.find('.extension').text(contact.internal_number)

                listItem.appendTo(list)
            })

            // Hack in popout to display bottom border.
            $('.contacts .list .contact:visible:last').addClass('last')

            // Trigger the callback function to receive presence data
            // after the list is fully built.
            data.callback({})
            // Hide element.
            $('embed').hide()
        })

        // Blink every phone icon with class "ringing".
        let blink = () => {
            let ringingNow = $('.status-icon.ringing')
            $(ringingNow).toggleClass('available').toggleClass('busy')
        }
        setInterval(blink, 400)

        let fade = function() {
            let icon = $('.connecting.connection-icon:visible')
            if ($(icon).css('opacity') === '0') {
                icon.fadeTo(400, 1.0)
            } else {
                icon.fadeTo(400, 0)
            }
        };
        setInterval(fade, 1000)


        // Call a contact when clicking on one.
        $('.contacts').on('click', '.status-icon, .name, .extension', (e) => {
            let extension = $(e.currentTarget).closest('.contact').find('.extension').text()
            if (extension && extension.length) {
                this.app.emit('panel.dial', {'b_number': extension})
            }
        });

        // Search through contacts while typing.
        $('.search-form :input').keyup((e) => {
            const list = $('.contacts .list')
            searchQuery = $(e.currentTarget).val().trim().toLowerCase()
            $(list).find('.contact.last').removeClass('last')
            // Filter list.
            $.each($('.contacts .list .contact'), (index, contact) => {
                // Hide contact if not a match.
                if ($(contact).find('.name').text().toLowerCase().indexOf(searchQuery) === -1 &&
                        $(contact).find('.extension').text().toLowerCase().indexOf(searchQuery) === -1) {
                    $(contact).addClass('hide')
                } else {
                    $(contact).removeClass('hide')
                }
            })

            // Show a message if no contacts matched.
            if ($('.contacts .list .contact:visible').length) {
                $('.widget.contacts .list').css('overflow-x', 'auto')
                $('.widget.contacts .not-found-contacts').addClass('hide')
                // hack in popout to display bottom border
                $('.contacts .list .contact:visible:last').addClass('last')
            } else {
                $('.widget.contacts .list').css('overflow-x', 'hidden')
                $('.widget.contacts .not-found-contacts').removeClass('hide')
            }
        }).keydown((e) => {
            // Don't submit this form on enter.
            if (e.which === 13) {
                e.preventDefault()
            }
        })
    }


    toString() {
        return `${this.app} [ContactsActions]    `
    }
}

module.exports = ContactsActions
