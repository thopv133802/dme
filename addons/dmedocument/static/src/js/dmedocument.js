odoo.define("dmedocument.document.view.kanban.widgets", function (require) {
    "use strict"

    const AbstractField = require("web.AbstractField")
    const ActionManager = require('web.ActionManager')
    const FormController = require("web.FormController")
    const FormView = require("web.FormView")
    const WebCore = require("web.core")
    const _t = WebCore._t
    const FieldRegistry = require("web.field_registry")
    const ViewRegistry = require("web.view_registry")
    const BasicFields = require("web.basic_fields")
    const FieldBinaryFile = BasicFields.FieldBinaryFile
    const UrlWidget = require("web.basic_fields").UrlWidget

    const AbstractOwlField = require("web.AbstractFieldOwl")
    const OwlFieldRegistry = require("web.field_registry_owl")

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
                    this.getCurrentController().widget.trigger_up("dme-document-action-manager-custom-event-reselect-multiple", {
                        document_ids: action.payload
                    })
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

    const DMEDocumentSpreadsheetController = FormController.extend({

    })

    const DMEDocumentSpreadsheetFormView = FormView.extend({
        config: _.extend({}, FormView.prototype.config, {
            Controller: DMEDocumentSpreadsheetController
        })
    })


    FieldRegistry.add("DMEDocumentFieldBinaryFile", DMEDocumentFieldBinaryFile)
    FieldRegistry.add("ClipboardUrlWidget", ClipboardUrlWidget)
    FieldRegistry.add("GlobeUrlWidget", GlobeUrlWidget)
    ViewRegistry.add("DMEDocumentSpreadsheetFormView", DMEDocumentSpreadsheetFormView)
    OwlFieldRegistry.add("FieldOwlGlobeUrl", FieldOwlGlobeUrl)

    return {
        DMEDocumentFieldBinaryFile: DMEDocumentFieldBinaryFile,
        DMEDocumentSpreadsheetFormView: DMEDocumentSpreadsheetFormView,
        ClipboardUrlWidget: ClipboardUrlWidget,
        GlobeUrlWidget: GlobeUrlWidget,
        FieldOwlGlobeUrl: FieldOwlGlobeUrl,
        FieldSpreadsheet: FieldSpreadsheet
    }
})




