odoo.define("dmedocument.document.view.kanban.widgets", function (require) {
    "use strict"

    const AbstractField = require("web.AbstractField")
    const ActionManager = require('web.ActionManager')
    const KanbanController = require("web.KanbanController")
    const FormController = require("web.FormController")
    const FormView = require("web.FormView")
    const KanbanView = require("web.KanbanView")
    const KanbanRecord = require("web.KanbanRecord")
    const KanbanRenderer = require("web.KanbanRenderer")
    const ListView = require("web.ListView")
    const ListController = require("web.ListController")
    const Activity = require("mail.Activity")
    const Framework = require("web.framework")
    const WebCore = require("web.core")
    const QWeb = WebCore.qweb
    const _t = WebCore._t
    const FieldRegistry = require("web.field_registry")
    const ViewRegistry = require("web.view_registry")
    const BasicFields = require("web.basic_fields")
    const FieldBinaryFile = BasicFields.FieldBinaryFile
    const UrlWidget = require("web.basic_fields").UrlWidget

    const AbstractOwlField = require("web.AbstractFieldOwl")
    const OwlFieldRegistry = require("web.field_registry_owl")
    const {Component, useState} = owl;


    function xtos(sdata) {
      const out = XLSX.utils.book_new();
      sdata.forEach(function(xws) {
        const aoa = [[]];
        const rowobj = xws.rows;
        for(let  ri = 0; ri < rowobj.len; ++ri) {
          const row = rowobj[ri];
          if(!row) continue;
          aoa[ri] = [];
          Object.keys(row.cells).forEach(function(k) {
            const idx = +k;
            if(isNaN(idx)) return;
            aoa[ri][idx] = row.cells[k].text;
          });
        }
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        XLSX.utils.book_append_sheet(out, ws, xws.name);
      });
      return out;
    }

    const FieldSpreadsheet = AbstractField.extend({
        supportedFieldTypes: ["text", "char"],
        tagName: "div",
        className: "o_field_widget",
        init: function() {
            this._super.apply(this, arguments)
            const self = this
        },
        start: function() {
            this._super.apply(this, arguments)
            const self = this
            self.spreadsheet = x_spreadsheet(self.$el[0], {
                mode: self.mode === "edit" ? "edit": "read",
                showToolbar: true,
                view: {
                    height: () => document.documentElement.clientHeight,
                    width: () => document.documentElement.clientWidth * 0.80 - 32
                },
            })
            self.spreadsheet.loadData(self.value ? JSON.parse(self.value): [{}])
            const $bottombar = self.$el.find(".x-spreadsheet-bottombar")
            $bottombar.find(".x-spreadsheet-dropdown").remove()
            $bottombar.prependTo(self.$el.find(".x-spreadsheet"))
            $bottombar.css({"padding-left": 0, "border-bottom": "1px solid #e0e2e4"})

            const $toolbar = self.$el.find(".x-spreadsheet-toolbar")
            $toolbar.css({"padding-left": "16px", "margin-right": 0})
        },
        _renderReadonly: function() {
            const self = this
            self.$el.find(".x-spreadsheet-menu > li").first().remove()
        },
        commitChanges: function () {
            const self = this
            self._setValue(
                JSON.stringify(self.spreadsheet.getData())
            )
        },
        destroy: function() {
            this._super.apply(this, arguments)
        }
    })

    FieldRegistry.add("FieldSpreadsheet", FieldSpreadsheet)

    class FieldOwlGlobeUrl extends AbstractOwlField {
        static template = "dmedocument.FieldOwlGlobeUrlTemplate"
        static supportFieldTypes = ["char"]
        constructor(...args) {
            super(...args)
        }
    }

    const GlobeUrlWidget = UrlWidget.extend({
        init: function() {
            this._super.apply(this, arguments)
            this.tagName = "div"
        },
        _renderReadonly: function() {
            this.$el.empty().addClass("d-flex flex-nowrap align-items-center")
                .append($("<span/>", {style: "color: #0e90b8"}).append($("<i/>", {class: "fa fa-globe mr4"})))
                .append($("<a/>", {target: "_blank", href: this.value, class: "text-truncate", style: "font-size: 11px"}).text(this.value))
        }
    })

    const ClipboardUrlWidget = UrlWidget.extend({
        init: function() {
            this._super.apply(this, arguments)
            this.tagName = "div"

            const self = this;

            self.href = this.value;
            if (self.value && !self.websitePath) {
                const regex = /^(?:[fF]|[hH][tT])[tT][pP][sS]?:\/\//;
                self.href = !regex.test(self.value) ? `http://${self.href}` : self.href;
            }
            //Input chỉ để hiển thị cho đẹp
            self.$input = $("<input/>").addClass("o_input")
                .attr("type", "text")
                .attr('value', self.href)
                .attr('readonly', "readonly")
                .text(self.href)
            //A mới chính là container của ClipboardJS - nhưng nó hiển thị không đẹp nên ta giấu nó bằng position absolute
            self.$a = $("<a/>")
                .attr("href", self.href)
                .attr("style", "position: absolute; white-space: nowrap; overflow: hidden; right: -9999px")
                .text(self.href)

            self.$button = $("<button/>", {
                type: "button",
                class: "btn btn-secondary fa fa-clipboard",
                "data-clipboard-text": self.href
            }).text(" Copy").tooltip({title: _t('Copied !'), trigger: 'manual', placement: 'right'});

            self.clipboardJS = new ClipboardJS(self.$button[0], {
                text: function(){
                    return self.href.trim()
                },
                container: self.$a[0]
            })
            self.clipboardJS.on('success', function () {
                _.defer(function () {
                    self.$button.tooltip('show');
                    _.delay(function () {
                        self.$button.tooltip('hide');
                    }, 800);
                });
            });
        },
        _renderReadonly: function() {
            this.$el.addClass(" o_field_widget d-inline-flex")
                .append(this.$input)
                .append(this.$button)
                .append(this.$a)
        },
        destroy: function() {
            this._super.apply(this, arguments)
            this.clipboardJS.destroy()
        }
    })

    ActionManager.include({
        _handleAction: function(action, options) {
            if(action.type === "ir.actions.client") {
                if(action.tag === "close_dialog_and_refresh") {
                    this._closeDialog()
                    this.getCurrentController().widget.trigger_up("reload", {keepChanges: true})
                    return Promise.resolve()
                }
                else if(action.tag === "do_nothings") {
                    this.getCurrentController().widget.trigger_up("reload", {keepChanges: true})
                    return Promise.resolve()
                }
            }
            return this._super.apply(this, arguments)
        },
    })

    KanbanRecord.include({
        init: function(parent, state, options) {
            this._super(parent, state, options)
            this.fileuploadID = _.uniqueId("o_fileupload")
            this.accepted_file_extensions = "*"
            this.fileReader = new FileReader()
        },
        events: _.extend({}, KanbanRecord.prototype.events, {
            "click .dme-document-viewer": "_onDocumentViewerButtonClicked",
            "click .dme-document-fill": "_onDocumentFillButtonClicked",
            "click .dme-document-add-link": "_onDocumentAddLinkButtonClicked",
            "click .dme-document-spreadsheet-download": "_onDocumentSpreadsheetDownloadClicked",
            "click .dme-document-kanban-record": "_onDMEDocumentKanbanRecordClicked"
        }),
        _onDMEDocumentKanbanRecordClicked: function(event) {
            event.preventDefault()
            event.stopPropagation()
            this.trigger_up("dme-document-kanban-record-clicked", {
                document: {
                    id: this.record.id.raw_value,
                    document_type: this.record.document_type.raw_value,
                    active: this.record.active.raw_value,
                    permission_write: this.record.permission_write.raw_value,
                    icon: this.record.icon.raw_value,
                    name: this.record.name.raw_value,
                    workspace_id: this.record.workspace_id.raw_value,
                    tag_ids: this.record.tag_ids.raw_value,
                    owner: this.record.owner.raw_value
                }
            })
        },
        _onDocumentSpreadsheetDownloadClicked: function(clickEvent) {
            clickEvent.stopPropagation()
            clickEvent.preventDefault()
            const workbook = xtos(JSON.parse(this.record.spreadsheet_content.raw_value))
            XLSX.writeFile(workbook, this.record.name.raw_value + ".xlsx")
        },
        _onDocumentFillButtonClicked: function () {
            if(this.modelName !== "dmedocument.document") return
            if(this.record.document_type.raw_value !== "upload") return

            const self = this

            self._rpc({
                "route": "/dmedocument/document/permission/upload",
                "params": {
                    document_id: self.record.id.raw_value
                }
            }).then(function(response) {
                const [isOK, message] = response
                if(isOK) {
                    const $formContainer = $(QWeb.render("dmedocument.dmedocument_template_document_upload", {
                        fileupload_id: self.fileupload_id,
                        csrf_token: WebCore.csrf_token,
                        accepted_file_extensions: "*",
                        fileupload_action: "/dmedocument/document/fill",
                        document_id: self.record.id.raw_value
                    }))

                    const $form = $formContainer.find(".dme-form-document-upload")
                    $form.on("submit", function(submitEvent) {
                        submitEvent.preventDefault()
                        const form = submitEvent.currentTarget;
                        fetch(form.action, {
                            method: form.method,
                            body: new FormData(form)
                        }).then(function(response) {
                            self.trigger_up('reload', { keepChanges: true });
                            $formContainer.remove()
                            Framework.unblockUI()
                            response.json()
                                .then((message) => {
                                    self.displayNotification({
                                        title: message
                                    })
                                })
                        }, function(error) {
                            console.log("Document fill failed: ")
                            console.log(error)
                            self.displayNotification({
                                title: error
                            })
                        })
                        Framework.blockUI()
                    })

                    const $input = $formContainer.find(".dme-input-document-upload")
                    $input.on("change", function(changeEvent) {
                        $form.submit()
                    })

                    self.$el.append($formContainer)
                    $input.click()
                }
                else {
                    self.displayNotification({
                        title: _t(message)
                    })
                }
            })

        },
        _onDocumentViewerButtonClicked: function () {
            const self = this
            if (self.modelName !== "dmedocument.document") return

            if(self.record.document_type.raw_value === "spreadsheet") {
                const $dialogManager = $(".o_DialogManager")
                if ($dialogManager) {
                    const $dialogContent = $(QWeb.render("dmedocument.dmedocument_template_document_spreadsheet_viewer", {
                        "document_id": self.record.id.raw_value,
                        "document_name": self.record.name.raw_value
                    }))
                    $dialogContent.find(".o_AttachmentViewer_headerItemButtonClose").click(function (ev) {
                        ev.stopPropagation()
                        $dialogManager.empty()
                    })
                    const spreadsheet = x_spreadsheet($dialogContent.find(".dme-document-spreadsheet-viewer").first()[0], {
                        mode: "read",
                        showToolbar: false,
                        showContextmenu: true,
                        view: {
                            height: () => document.documentElement.clientHeight - 92,
                            width: () => document.documentElement.clientWidth * 0.9
                        },
                    })

                    self._rpc({
                        "route": "/dmedocument/document/spreadsheet_content",
                        "params": {
                            "document_id": self.record.id.raw_value
                        }
                    }).then(function(response) {
                        const [status, spreadsheet_content] = response
                        if (status){
                            spreadsheet.loadData(spreadsheet_content ? JSON.parse(spreadsheet_content) : [{}])
                            const $spreadsheet = $dialogContent.find(".x-spreadsheet").first()

                            $spreadsheet.find(".x-spreadsheet-menu > li").first().remove()
                            const $bottombar = $spreadsheet.find(".x-spreadsheet-bottombar")
                            $bottombar.css({"padding-left": 0, "border-bottom": "1px solid #e0e2e4"})
                            $bottombar.find(".x-spreadsheet-dropdown").remove()
                            $bottombar.prependTo($spreadsheet)

                            $dialogManager.empty().append($dialogContent)

                            $dialogContent.find(".o_AttachmentViewer_buttonDownload").click(function (ev) {
                                ev.stopPropagation()
                                const workbook = xtos(spreadsheet.getData())
                                XLSX.writeFile(workbook, self.record.name.raw_value + ".xlsx")
                            })
                        }
                        else {
                            self.displayNotification({
                                title: _t(spreadsheet_content)
                            })
                        }
                    })
                }
            }
            else {
                const fileURL = "/web/content/dmedocument.document/" + self.record.id.raw_value + "/content"
                let iFrameURL = fileURL
                if (self.record.icon.raw_value === "pdf")
                    iFrameURL = "/web/static/lib/pdfjs/web/viewer.html?file=" + iFrameURL
                else if (["doc", "docx"].includes(self.record.icon.raw_value))
                    iFrameURL = "/web/static/lib/pdfjs/web/viewer.html?file=/dmedocument/document/docx2pdf/"  + self.record.id.raw_value
                else if (["xls", "xlsx"].includes(self.record.icon.raw_value))
                    iFrameURL = "/web/static/lib/pdfjs/web/viewer.html?file=/dmedocument/document/xlsx2pdf/" + self.record.id.raw_value

                if(["doc", "docx", "xls", "xlsx"].includes(self.record.icon.raw_value)) {
                    self._rpc({
                        "route": "/dmedocument/document/document_viewable/" + self.record.id.raw_value,
                        "params": {}
                    }).then(function(response) {
                        const [viewable, message] = response
                        if(viewable) {
                            const $dialogManager = $(".o_DialogManager")
                            if ($dialogManager) {
                                const $dialogContent = $(QWeb.render("dmedocument.dmedocument_template_document_viewer", {
                                    "document_id": self.record.id.raw_value,
                                    "document_name": self.record.name.raw_value,
                                    "iframe_url": iFrameURL
                                }))
                                $dialogContent.find(".o_AttachmentViewer_headerItemButtonClose").click(function (ev) {
                                    ev.stopPropagation()
                                    $dialogManager.empty()
                                })
                                $dialogContent.find(".o_AttachmentViewer_buttonDownload").click(function (ev) {
                                    ev.stopPropagation()
                                    window.open(fileURL + "?download=True")
                                })
                                $dialogManager.empty().append($dialogContent)
                            }
                        }
                        else {
                            self.displayNotification({
                                title: _t("This document cannot be previewed" + (message ?  ": " + message : ""))
                            })
                        }
                    })
                }
                else {
                    const $dialogManager = $(".o_DialogManager")
                    if ($dialogManager) {
                        const $dialogContent = $(QWeb.render("dmedocument.dmedocument_template_document_viewer", {
                            "document_id": self.record.id.raw_value,
                            "document_name": self.record.name.raw_value,
                            "iframe_url": iFrameURL
                        }))
                        $dialogContent.find(".o_AttachmentViewer_headerItemButtonClose").click(function (ev) {
                            ev.stopPropagation()
                            $dialogManager.empty()
                        })
                        $dialogContent.find(".o_AttachmentViewer_buttonDownload").click(function (ev) {
                            ev.stopPropagation()
                            window.open(fileURL + "?download=True")
                        })
                        $dialogManager.empty().append($dialogContent)
                    }
                }
            }
        }
    })

    const DMEDocumentFieldBinaryFile = FieldBinaryFile.extend({
        _renderReadonly: function () {
            this.do_toggle(!!this.value)
            if (this.value) {
                this.$el.empty().append(_t("Download <span class = 'fa fa-download'></span>"))
                if (this.recordData.id) {
                    this.$el.css('cursor', 'pointer')
                } else {
                    this.$el.css('cursor', 'not-allowed')
                }

            }
            if (!this.res_id) {
                this.$el.css('cursor', 'not-allowed')
            } else {
                this.$el.css('cursor', 'pointer')
            }
        }
    })

    const renderButtons = function () {
        this._super.apply(this, arguments)
        const self = this
        if (self.$buttons) {
            self.$buttons.on("click", ".dme-document-request", function () {
                const workspaceContainer = document.querySelector(".list-group-item-action.active")
                if(!workspaceContainer) {
                    console.log("Work space is null")
                    return
                }
                const workspace = workspaceContainer.textContent
                return self._rpc({
                    "route": "/web/action/load",
                    "params": {
                        "action_id": "dmedocument.dmedocument_action_document_request_wizard"
                    }
                }).then(function (action) {
                    if (action) {
                        action["context"] = JSON.parse(action["context"])
                        action["context"]["default_workspace_name"] = workspace
                        self.do_action(action)
                    }
                })
            })
            self.$buttons.on("click", ".dme-document-upload", function () {
                const workspaceContainer = document.querySelector(".list-group-item-action.active")
                if(!workspaceContainer) {
                    console.log("Work space is null")
                    return
                }
                const workspace = workspaceContainer.textContent
                return self._rpc({
                    "route": "/web/action/load",
                    "params": {
                        "action_id": "dmedocument.dmedocument_action_document_upload_wizard"
                    }
                }).then(function (action) {
                    if (action) {
                        action["context"] = JSON.parse(action["context"])
                        action["context"]["default_workspace_name"] = workspace
                        return self.do_action(action)
                    }
                })
            })
            self.$buttons.on("click", ".dme-document-add-link", function() {
                const workspaceContainer = document.querySelector(".list-group-item-action.active")
                if(!workspaceContainer) {
                    console.log("Work space is null")
                    return
                }
                const workspace = workspaceContainer.textContent
                return self._rpc({
                    "route": "/web/action/load",
                    "params": {
                        "action_id": "dmedocument.dmedocument_action_document_add_link_wizard"
                    }
                }).then(function(action) {
                    if(action) {
                        action["context"] = JSON.parse(action["context"])
                        action["context"]["default_workspace_name"] = workspace
                        return self.do_action(action)
                    }
                })
            })
            self.$buttons.on("click", ".dme-document-create-spreadsheet", function() {
                const workspaceContainer = document.querySelector(".list-group-item-action.active")
                if(!workspaceContainer) {
                    console.log("Work space is null")
                    return
                }
                const workspace = workspaceContainer.textContent
                self._rpc({
                    "route": "/web/action/load",
                    "params": {
                        "action_id": "dmedocument.dmedocument_action_document_spreadsheet"
                    }
                }).then(function(action) {
                    if(action) {
                        action["context"] = JSON.parse(action["context"])
                        action["context"]["default_workspace_name"] = workspace
                        action["context"]["default_document_type"] = "spreadsheet"
                        return self.do_action(action)
                    }
                })
            })
            self.$buttons.on("click", ".dme-document-share", function() {
                const workspaceContainer = document.querySelector(".list-group-item-action.active")
                if(!workspaceContainer) {
                    console.log("Work space is null")
                    return
                }
                const workspace = workspaceContainer.textContent
                self._rpc({
                    "route": "/web/action/load",
                    "params": {
                        "action_id": "dmedocument.dmedocument_action_document_share_wizard"
                    }
                }).then(function(action) {
                    if(action) {
                        action["context"] = JSON.parse(action["context"])
                        action["context"]["default_workspace_name"] = workspace
                        return self.do_action(action)
                    }
                })
            })
        }
    };

    const DMEDocumentSpreadsheetController = FormController.extend({

    })

    const DMEDocumentKanbanRenderer = KanbanRenderer.extend({

    })

    const DMEDocumentKanbanController = KanbanController.extend({
        custom_events: _.extend({}, KanbanController.prototype.custom_events, {
            "dme-document-kanban-record-clicked": "_onKanbanRecordClicked"
        }),
        events: _.extend({}, KanbanController.prototype.custom_events, {
            "click .dme-document-btn-download": "_onDocumentDownload",
            "click .dme-document-btn-share": "_onDocumentShare",
            "click .dme-document-btn-archive": "_onDocumentArchive",
            "click .dme-document-btn-replace": "_onDocumentReplace",
            "change .dme-document-name": "_onDocumentChangeName",
            "change .dme-document-workspace": "_onDocumentChangeWorkspace",
            "change .dme-document-append-tag": "_onDocumentAppendTag",
            "click .dme-document-btn-remove-tag": "_onDocumentRemoveTag",
        }),

        init: function() {
            const self = this
            self._super.apply(this, arguments)
            self.$sidebar = $(QWeb.render("dmedocument.dmedocument_document_sidebar"))
            self.$sidebar_header = self.$sidebar.find(".dme-document-sidebar-header").first()
            self.$sidebar_content = self.$sidebar.find(".dme-document-sidebar-content").first()
            self.blurSidebar()
            self.$sidebar_content_buttons = self.$sidebar_content.find(".dme-document-sidebar-content-buttons").first()
            self.$sidebar_content_button_download = self.$sidebar_content_buttons.find(".dme-document-btn-download").first()
            self.$sidebar_content_button_share = self.$sidebar_content_buttons.find(".dme-document-btn-share").first()
            self.$sidebar_content_button_replace = self.$sidebar_content_buttons.find(".dme-document-btn-replace").first()
            self.$sidebar_content_button_archive = self.$sidebar_content.find(".dme-document-btn-archive").first()
            self.$sidebar_content_fields = self.$sidebar_content.find(".dme-document-sidebar-content-fields").first()
            self.$sidebar_content_field_name = self.$sidebar_content_fields.find(".dme-document-name").first()
            self.$sidebar_content_field_owner = self.$sidebar_content_fields.find(".dme-document-owner").first()
            self.$sidebar_content_field_workspace = self.$sidebar_content_fields.find(".dme-document-workspace").first()
            self.$sidebar_content_field_datalist_tags = self.$sidebar_content_fields.find(".dme-document-datalist-tags").first()
            self.$sidebar_content_field_tags = self.$sidebar_content_fields.find(".dme-document-tags").first()
            self.$sidebar_content_field_append_tag = self.$sidebar_content_fields.find(".dme-document-append-tag").first()
        },

        start: function() {
            const self = this
            return Promise.all([self._super.apply(this, arguments),
                self._rpc({
                    model: "dmedocument.workspace",
                    method: "search_read",
                    args: [[], ["id", "name"]]
                }).then(function(workspaces) {
                    self.workspaces = workspaces
                }),
            ])
            .then(function() {
                self.$el.find(".o_content").append(self.$sidebar)
            })
        },

        blurSidebar: function() {
            this.$sidebar_header.attr("style", "display: none !important;")
            this.$sidebar_content.attr("style", "display: none !important;")
        },
        setVisibility: function($element, isVisible) {
            if(isVisible)
                $element.attr("style", "display: initial;")
            else
                $element.attr("style", "display: none !important;")
        },
        _onDocumentAppendTag: function(event) {
            const self = this
            if(!self.tags) return
            const tag_name = $(event.currentTarget).val()
            const tag = self.tags.find((tag) => tag.name === tag_name)
            if (!tag) return
            this._rpc({
                model: "dmedocument.document",
                method: "append_tag",
                args: [self.document.id, tag.id]
            }).then((document) => {
                self.document = document
                self._renderSidebarContentFieldTags()
                self.trigger_up("reload", {
                    keepChanges: true
                })
            })
        },
        _onDocumentRemoveTag: function(event) {
            const self = this
            const tag_id = event.currentTarget.getAttribute("data-id")
            this._rpc({
                model: "dmedocument.document",
                method: "remove_tag",
                args: [
                    self.document.id,
                    tag_id
                ]
            }).then((document) => {
                self.document = document
                self._renderSidebarContentFieldTags()
                self.trigger_up("reload", {
                    keepChanges: true
                })
            })
        },
        _onDocumentDownload: function() {
            window.open("/web/content/dmedocument.document/" + this.document.id + "/content?download=True")
        },
        _onDocumentShare: function() {
            const self = this
            if (!self.document) return
            self._rpc({
                route: "/web/action/load",
                params: {
                    action_id: "dmedocument.dmedocument_action_document_share_wizard"
                }
            }).then(function(action) {
                if(!action) return
                action["context"] = JSON.parse(action["context"])
                action["context"]["default_document_ids"] = [self.document.id]
                self.do_action(action)
            })
        },
        _onDocumentChangeName: function(event) {
            const self = this
            if(!self.document) return
            self._rpc({
                model: "dmedocument.document",
                method: "change_name",
                args: [self.document.id, $(event.currentTarget).val()]
            }).then(() => self.update({}, {
                reload: true
            }))
        },
        _onDocumentArchive: function() {
            const self = this
            if (!self.document) return
            self._rpc({
                model: "dmedocument.document",
                method: "archive_by_id",
                args: [
                    self.document.id
                ]
            }).then(() => {
                self.update({}, {
                    reload: true
                })
                self.$sidebar_header.attr("style", "display: none !important;")
                self.$sidebar_content.attr("style", "display: none !important;")
            })
        },
        _onKanbanRecordClicked: function(event) {
            const document = event.data.document
            if (!document) return

            const self = this
            self.document = document

            self.$sidebar_header.attr("style", "display: initial")
            self.$sidebar_content.attr("style", "display: initial")

            self.$sidebar_header.empty().append($("<img/>", {
                src: "/dmedocument/static/src/img/file_icons/" + document.icon + ".svg",
                style: "width: 80px; height: 80px;"
            }))

            self.setVisibility(self.$sidebar_content_button_download, document.permission_write && ["file"].includes(document.document_type))
            self.setVisibility(self.$sidebar_content_button_share, document.active)
            self.setVisibility(self.$sidebar_content_button_replace, document.permission_write && document.document_type === "file")
            self.setVisibility(self.$sidebar_content_button_archive, document.permission_write && document.active)

            self.$sidebar_content_field_name.val(document.name.substring(0, document.name.lastIndexOf(".")))
            self.$sidebar_content_field_owner.val(document.owner)

            self._renderSidebarContentFieldWorkspace()
            self._renderSidebarContentFieldTags()
        },
        _renderSidebarContentFieldWorkspace: function() {
            const self = this
            self.$sidebar_content_field_workspace.empty()
            self.workspaces.forEach((workspace) => {
                self.$sidebar_content_field_workspace.append($(`
                    <option value = "${workspace.id}" ${workspace.id === self.document.workspace_id ? "selected" : ""}>${workspace.name}</option>
                `))
            })
        },
        _renderSidebarContentFieldTags: function() {
            const self = this
            self.$sidebar_content_field_tags.empty()
            self.$sidebar_content_field_datalist_tags.empty()
            self.$sidebar_content_field_append_tag.val("")
            self._rpc({
                model: "dmedocument.tag",
                method: "search_read_by_workspace",
                args: [
                    self.document.workspace_id
                ]
            }).then((tags) => {
                self.tags = tags
                tags.forEach((tag) => {
                    if(self.document.tag_ids.includes(tag.id)) {
                        self.$sidebar_content_field_tags.append($(`
                            <div class="input-group mb-2">
                              <input class="form-control" value = "${tag.name}">
                              <div class="input-group-append">
                                <button class="btn btn-danger fa fa-remove dme-document-btn-remove-tag" data-id = "${tag.id}"/>
                              </div>
                            </div>
                        `))
                    }
                    else {
                        self.$sidebar_content_field_datalist_tags.append($(`
                            <option value = "${tag.name}"></option>
                        `))
                    }
                })
            })
        },
        _onDocumentReplace: function() {
            const self = this
            if (!self.document) return
            const $formContainer = $(QWeb.render("dmedocument.dmedocument_template_document_upload", {
                fileupload_id: self.fileupload_id,
                csrf_token: WebCore.csrf_token,
                accepted_file_extensions: "*",
                fileupload_action: "/dmedocument/document/replace_content",
                document_id: self.document.id
            }))

            const $form = $formContainer.find(".dme-form-document-upload")
            $form.on("submit", function(submitEvent) {
                submitEvent.preventDefault()
                const form = submitEvent.currentTarget;
                fetch(form.action, {
                    method: form.method,
                    body: new FormData(form)
                }).then(function(response) {
                    self.trigger_up('reload', { keepChanges: true });
                    $formContainer.remove()
                    Framework.unblockUI()
                    response.json()
                        .then((document) => {
                            self.trigger_up("dme-document-kanban-record-clicked", {
                                document: document
                            })
                        })

                }, function(error) {
                    self.displayNotification({
                        title: error
                    })
                })
                Framework.blockUI()
            })

            const $input = $formContainer.find(".dme-input-document-upload")
            $input.on("change", function(changeEvent) {
                $form.submit()
            })

            self.$el.append($formContainer)
            $input.click()
        },

        _onDocumentChangeWorkspace: function(event) {
            const self = this
            if (!self.document) return
            self._rpc({
                model: "dmedocument.document",
                method: "write",
                args: [
                    self.document.id,
                    {
                        "workspace_id": self.$sidebar_content_field_workspace.children("option:selected").val()
                    }
                ]
            }).then(() => {
                self.trigger_up("reload", {keepChanges: true})
                self.blurSidebar()
            })
        },
        renderButtons: renderButtons
    })

    const DMEDocumentListController = ListController.extend({
        renderButtons: renderButtons
    })

    const DMEDocumentSpreadsheetFormView = FormView.extend({
        config: _.extend({}, FormView.prototype.config, {
            Controller: DMEDocumentSpreadsheetController
        })
    })

    const DMEDocumentKanbanView = KanbanView.extend({
        config: _.extend({}, KanbanView.prototype.config, {
            Controller: DMEDocumentKanbanController,
            Renderer: DMEDocumentKanbanRenderer,
        })
    })

    const DMEDocumentListView = ListView.extend({
        config: _.extend({}, ListView.prototype.config, {
            Controller: DMEDocumentListController,
        })
    })

    FieldRegistry.add("DMEDocumentFieldBinaryFile", DMEDocumentFieldBinaryFile)
    FieldRegistry.add("ClipboardUrlWidget", ClipboardUrlWidget)
    FieldRegistry.add("GlobeUrlWidget", GlobeUrlWidget)
    ViewRegistry.add("DMEDocumentKanbanView", DMEDocumentKanbanView)
    ViewRegistry.add("DMEDocumentListView", DMEDocumentListView)
    ViewRegistry.add("DMEDocumentSpreadsheetFormView", DMEDocumentSpreadsheetFormView)
    OwlFieldRegistry.add("FieldOwlGlobeUrl", FieldOwlGlobeUrl)

    return {
        DMEDocumentFieldBinaryFile: DMEDocumentFieldBinaryFile,
        DMEDocumentKanbanView: DMEDocumentKanbanView,
        DMEDocumentListView: DMEDocumentListView,
        DMEDocumentSpreadsheetFormView: DMEDocumentSpreadsheetFormView,
        ClipboardUrlWidget: ClipboardUrlWidget,
        GlobeUrlWidget: GlobeUrlWidget,
        FieldOwlGlobeUrl: FieldOwlGlobeUrl,
        FieldSpreadsheet: FieldSpreadsheet,
        DMEDocumentKanbanRenderer: DMEDocumentKanbanRenderer
    }
})




