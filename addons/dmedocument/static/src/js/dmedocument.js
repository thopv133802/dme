odoo.define("dmedocument.document.view.kanban.widgets", function (require) {
    "use strict"

    const AbstractField = require("web.AbstractField")
    const ActionManager = require('web.ActionManager')
    const KanbanController = require("web.KanbanController")
    const FormController = require("web.FormController")
    const FormView = require("web.FormView")
    const KanbanView = require("web.KanbanView")
    const KanbanRecord = require("web.KanbanRecord")
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
            "click .dme-document-spreadsheet-download": "_onDocumentSpreadsheetDownloadClicked"
        }),
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
                            console.log(response)
                            self.trigger_up('reload', { keepChanges: true });
                            $formContainer.remove()
                            Framework.unblockUI()
                        }, function(error) {
                            console.log(error)
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
                        .loadData(self.record.spreadsheet_content && self.record.spreadsheet_content.raw_value ? JSON.parse(self.record.spreadsheet_content.raw_value) : [{}])
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
            }
            else {
                const fileURL = "/web/content/dmedocument.document/" + self.record.id.raw_value + "/content"
                let iFrameURL = fileURL
                if (self.record.icon.raw_value === "pdf")
                    iFrameURL = "/web/static/lib/pdfjs/web/viewer.html?file=" + iFrameURL

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

    const DMEDocumentFormController = FormController.extend({

    })

    const DMEDocumentKanbanController = KanbanController.extend({
        renderButtons: renderButtons
    })

    const DMEDocumentListController = ListController.extend({
        renderButtons: renderButtons
    })

    const DMEDocumentFormView = FormView.extend({
        config: _.extend({}, FormView.prototype.config, {
            Controller: DMEDocumentFormController
        })
    })

    const DMEDocumentKanbanView = KanbanView.extend({
        config: _.extend({}, KanbanView.prototype.config, {
            Controller: DMEDocumentKanbanController
        })
    })

    const DMEDocumentListView = ListView.extend({
        config: _.extend({}, ListView.prototype.config, {
            Controller: DMEDocumentListController
        })
    })

    FieldRegistry.add("DMEDocumentFieldBinaryFile", DMEDocumentFieldBinaryFile)
    FieldRegistry.add("ClipboardUrlWidget", ClipboardUrlWidget)
    FieldRegistry.add("GlobeUrlWidget", GlobeUrlWidget)
    ViewRegistry.add("DMEDocumentKanbanView", DMEDocumentKanbanView)
    ViewRegistry.add("DMEDocumentListView", DMEDocumentListView)
    ViewRegistry.add("DMEDocumentFormView", DMEDocumentFormView)
    OwlFieldRegistry.add("FieldOwlGlobeUrl", FieldOwlGlobeUrl)

    return {
        DMEDocumentFieldBinaryFile: DMEDocumentFieldBinaryFile,
        DMEDocumentKanbanView: DMEDocumentKanbanView,
        DMEDocumentListView: DMEDocumentListView,
        DMEDocumentFormView: DMEDocumentFormView,
        ClipboardUrlWidget: ClipboardUrlWidget,
        GlobeUrlWidget: GlobeUrlWidget,
        FieldOwlGlobeUrl: FieldOwlGlobeUrl,
        FieldSpreadsheet: FieldSpreadsheet
    }
})




