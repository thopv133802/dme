odoo.define("dmedocument.Kanban", (require) => {
    "use strict"
    const AbstractKanbanRecord = require("web.KanbanRecord")
    const AbstractKanbanView = require("web.KanbanView")
    const AbstractKanbanController = require("web.KanbanController")
    const AbstractKanbanRenderer = require("web.KanbanRenderer")

    const ViewRegistry = require("web.view_registry")
    const Utils = require("dmedocument.Utils")
    const WebCore = require("web.core")
    const QWeb = WebCore.qweb
    const Framework = require("web.framework")
    const _t = WebCore._t

    const KanbanRecord = AbstractKanbanRecord.extend({
        events: _.extend({}, AbstractKanbanRecord.prototype.events, {
            "click .dme-document-kanban-record-btn-fill": "_onFillButtonClicked",
            "click .dme-document-kanban-record-btn-view": "_onViewButtonClicked",
            "click .dme-document-kanban-record-btn-select": "_onSelectButtonClicked",
            "click .dme-document-kanban-record-btn-select-one": "_onSelectOneButtonClicked"
        }),
        init: function () {
            this._super.apply(this, arguments)
            this.selected = false
        },
        deselect: function () {
            this.selected = false
            this._renderBtnSelect()
        },
        select: function () {
            this.selected = true
            this._renderBtnSelect()
        },
        _onFillButtonClicked: function (event) {
            event.stopPropagation()
        },
        _onViewButtonClicked: function (event) {
            event.stopPropagation()
        },
        _onSelectButtonClicked: function (event) {
            event.stopPropagation()
            this.selected = !this.selected
            this._renderBtnSelect()
            this.trigger_up("dme-document-kanban-record-custom-event-select", {
                document_id: this.record.id.raw_value
            })
        },
        _onSelectOneButtonClicked: function (event) {
            let hasMailActivity = $(event.target).parents('.o_mail_activity').length;
            if(hasMailActivity) return
            event.stopPropagation()
            this.selected = true
            this._renderBtnSelect()
            this.trigger_up("dme-document-kanban-record-custom-event-select-one", {
                document_id: this.record.id.raw_value
            })
        },
        _renderBtnSelect: function () {
            const $btn_select = this.$el.find(".dme-document-kanban-record-btn-select")
            if (this.selected) {
                $btn_select.addClass("fa-check-circle")
                    .removeClass("fa-circle-thin")
                this.$el.addClass("dme-document-kanban-record-style-selected")
            } else {
                $btn_select.addClass("fa-circle-thin")
                    .removeClass("fa-check-circle")
                this.$el.removeClass("dme-document-kanban-record-style-selected")
            }
        }
    })

    const KanbanController = AbstractKanbanController.extend({
        events: _.extend({}, AbstractKanbanController.prototype.events, {
            "click .dme-document-sidebar-btn-remove-tag": "_onSidebarBtnRemoveTagClicked",
        }),
        custom_events: _.extend({}, AbstractKanbanController.prototype.custom_events, {
            "dme-document-kanban-renderer-custom-event-kanban-record-select": "_onKanbanRendererCustomEventKanbanRecordSelected",
            "dme-document-kanban-renderer-custom-event-kanban-record-select-one": "_onKanbanRendererCustomEventKanbanRecordSelectedOne",
            "dme-document-action-manager-custom-event-reselect-multiple": "_onActionManagerCustomEventReselectMultiple",
        }),
        init: function () {
            this._super.apply(this, arguments)
            this.selected_document_ids = []
            this.documents = []
            this.workspaces = []
            this.tags = []
        },
        start: function () {
            const self = this
            return Promise.all([
                self._super.apply(this, arguments),
                self._rpc({
                    model: "dmedocument.workspace",
                    method: "search_read",
                    args: [
                        [],
                        ["id", "name"]
                    ]
                }).then((workspaces) => self.workspaces = workspaces),
            ])
                .then(() => {
                    self._renderSidebar()
                })
        },
        reload: function () {
            return this._super.apply(this, arguments)
                .then(() =>
                    this.renderer.selects(this.selected_document_ids)
                )
        },
        renderButtons: function($node) {
            this._super.apply(this, arguments)
            this.$buttons = $(QWeb.render("dmedocument.KanbanView.Buttons"))
            this.$buttons.on("click", ".dme-document-btn-upload", () => this._onUploadButtonClicked(this))
            this.$buttons.on("click", ".dme-document-btn-create-spreadsheet", () => this._onCreateSpreadsheetButtonClicked(this))
            this.$buttons.on("click", ".dme-document-btn-request", () => this._onRequestButtonClicked(this))
            this.$buttons.on("click", ".dme-document-btn-add-link", () => this._onAddLinkButtonClicked(this))
            this.$buttons.on("click", ".dme-document-btn-share", () => this._onShareButtonClicked(this))
            if($node)
                $node.append(this.$buttons)
        },
        _onUploadButtonClicked: (self) => {
            const workspace_name = Utils.extractCurrentWorkspace()
            self._rpc({
                "route": "/web/action/load",
                "params": {
                    "action_id": "dmedocument.dmedocument_action_document_upload_wizard"
                }
            }).then(function (action) {
                if (action) {
                    action["context"] = JSON.parse(action["context"])
                    action["context"]["default_workspace_name"] = workspace_name
                    return self.do_action(action)
                }
            })
        },
        
        _onCreateSpreadsheetButtonClicked: (self) => {
            const workspace_name = Utils.extractCurrentWorkspace()
            self._rpc({
                "route": "/web/action/load",
                "params": {
                    "action_id": "dmedocument.dmedocument_action_document_spreadsheet"
                }
            }).then(function(action) {
                if(action) {
                    action["context"] = JSON.parse(action["context"])
                    action["context"]["default_workspace_name"] = workspace_name
                    return self.do_action(action)
                }
            })
        },
        _onRequestButtonClicked: (self) => {
            const workspace_name = Utils.extractCurrentWorkspace()
            self._rpc({
                "route": "/web/action/load",
                "params": {
                    "action_id": "dmedocument.dmedocument_action_document_add_link_wizard"
                }
            }).then(function(action) {
                if(action) {
                    action["context"] = JSON.parse(action["context"])
                    action["context"]["default_workspace_name"] = workspace_name
                    return self.do_action(action)
                }
            })
        },
        _onAddLinkButtonClicked: (self) => {
            const workspace_name = Utils.extractCurrentWorkspace()
            self._rpc({
                "route": "/web/action/load",
                "params": {
                    "action_id": "dmedocument.dmedocument_action_document_add_link_wizard"
                }
            }).then(function(action) {
                if(action) {
                    action["context"] = JSON.parse(action["context"])
                    action["context"]["default_workspace_name"] = workspace_name
                    return self.do_action(action)
                }
            })
        },
        _onShareButtonClicked: (self) => {
            const workspace_name = Utils.extractCurrentWorkspace()
            self._rpc({
                "route": "/web/action/load",
                "params": {
                    "action_id": "dmedocument.dmedocument_action_document_share_wizard"
                }
            }).then(function(action) {
                if(action) {
                    action["context"] = JSON.parse(action["context"])
                    action["context"]["default_workspace_name"] = workspace_name
                    return self.do_action(action)
                }
            })
        },
        _loadSelectedDocuments: function () {
            if (this.selected_document_ids.length === 0) return new Promise((resolve) => resolve([]))
            return this._rpc({
                model: "dmedocument.document",
                method: "search_read",
                args: [
                    [["id", "in", this.selected_document_ids]],
                    ["id", "name", "icon", "workspace_id", "document_type", "permission_write", "active", "tag_ids", "owner"]
                ]
            })
        },
        _renderSidebar: function () {
            const self = this
            self._loadSelectedDocuments()
                .then((documents) => {
                    self.documents = documents
                    const common_workspace = new Set(documents.map((document) => document.workspace_id[0])).size === 1 ? documents[0].workspace_id : false
                    const $sidebar = $(QWeb.render("dme-document-sidebar", {
                        documents: documents,
                        workspaces: self.workspaces,
                        common_workspace: common_workspace
                    }));

                    self.$(".o_content").find(".dme-document-sidebar").remove()
                    self.$(".o_content").append($sidebar)

                    if (documents.length === 0) return

                    $sidebar.find(".dme-document-sidebar-btn-download").on("click", (event) => self._onSidebarButtonDownloadClicked(event))
                    $sidebar.find(".dme-document-sidebar-btn-share").on("click", (event) => self._onSidebarButtonShareClicked(event))
                    $sidebar.find(".dme-document-sidebar-btn-replace").on("click", (event) => self._onSidebarButtonReplaceClicked(event))
                    $sidebar.find(".dme-document-sidebar-btn-archive").on("click", (event) => self._onSidebarButtonArchiveClicked(event))

                    const $input_name = $sidebar.find(".dme-document-sidebar-input-name")
                    $input_name.on("change", (event) => self._onSidebarInputNameChanged(event))

                    const $input_workspace = $sidebar.find(".dme-document-sidebar-input-workspace")
                    Utils.configInputWithDatalist($input_workspace)
                    $input_workspace.on("change", (event) => self._onSidebarInputWorkspaceChanged(event))

                    const $container_tags = $sidebar.find(".dme-document-sidebar-container-tags")
                    const $input_append_tag = $sidebar.find(".dme-document-sidebar-input-append-tag")
                    const $datalist_tags = $sidebar.find(".dme-document-sidebar-datalist-tags")
                    const common_tag_ids = Utils.intersects(self.documents.map((document) => document.tag_ids))
                    if (common_workspace) {
                        self._rpc({
                            model: "dmedocument.tag",
                            method: "search_read_by_workspace",
                            args: [
                                common_workspace[0]
                            ]
                        }).then((tags) => {
                            self.tags = tags
                            tags.filter((tag) => !common_tag_ids.includes(tag.id)).forEach((tag) => {
                                $datalist_tags.append($(`
                                        <option value = "${tag.name}"/>
                                    `))
                            })
                            $input_append_tag.on("change", (event) => self._onSidebarInputAppendTagChanged(event))
                        })
                    }
                    self._rpc({
                        model: "dmedocument.tag",
                        method: "search_read_by_ids",
                        args: [
                            common_tag_ids
                        ]
                    }).then((tags) => {
                        tags.forEach((tag) => {
                            $container_tags.append($(`
                                <div class="input-group mb-2 container-tag-id-${tag.id}">
                                  <input class="form-control text-truncate" value = "${tag.name}" readonly>
                                  <div class="input-group-append">
                                    <button class="btn btn-outline-danger fa fa-remove dme-document-sidebar-btn-remove-tag" data-id = "${tag.id}"/>
                                  </div>
                                </div>
                            `))
                        })
                    })
                })
        },
        _onSidebarBtnRemoveTagClicked: function (event) {
            const self = this
            const tag_id = $(event.currentTarget).attr("data-id")
            if (!tag_id) return
            self._rpc({
                model: "dmedocument.document",
                method: "remove_tag",
                args: [
                    self.selected_document_ids,
                    tag_id
                ]
            }).then(() => {
                self._onTagRemoved(tag_id)
            })
        },
        _onTagRemoved: function (tag_id) {
            const self = this
            if (!tag_id) return
            self.$el.find(`.container-tag-id-${tag_id}`).remove()

            self.trigger_up("reload", {
                keepChanges: true
            })
        },
        _onTagAppended: function (tag) {
            const self = this
            if (!tag) return
            const $container_tags = self.$el.find(".dme-document-sidebar-container-tags")
            $container_tags.append($(`
                <div class="input-group mb-2">
                  <input class="form-control" value = "${tag.name}" readonly>
                  <div class="input-group-append">
                    <button class="btn btn-outline-danger fa fa-remove dme-document-sidebar-btn-remove-tag" data-id = "${tag.id}"/>
                  </div>
                </div>
            `))

            const $datalist_tags = self.$el.find(".dme-document-sidebar-datalist-tags")
            $datalist_tags.find(`option[value="${tag.name}"]`).remove()

            const $input_append_tag = self.$el.find(".dme-document-sidebar-input-append-tag")
            $input_append_tag.val("")

            self.trigger_up("reload", {
                keepChanges: true
            })
        },
        _onWorkspaceChanged: function (workspace) {
            const self = this
            if (!workspace) return
            self._rpc({
                model: "dmedocument.tag",
                method: "search_read_by_workspace",
                args: [
                    workspace.id
                ]
            }).then((tags) => {
                self.tags = tags
                const common_tag_ids = Utils.intersects(self.documents.map((document) => document.tag_ids))
                const $datalist_tags = self.$el.find(".dme-document-sidebar-datalist-tags")
                $datalist_tags.empty()
                tags.forEach((tag) => {
                    if (!common_tag_ids.includes(tag.id))
                        $datalist_tags.append($(`
                            <option value = "${tag.name}"/>
                        `))
                })
                self.trigger_up("reload", {
                    keepChanges: true
                })
            })
        },
        _onSidebarButtonDownloadClicked: function (event) {
            const self = this
            if (self.selected_document_ids.length === 1) {
                const document_id = self.selected_document_ids[0]
                window.open("/web/content/dmedocument.document/" + document_id + "/content?download=True")
            } else if (self.selected_document_ids.length > 1) {
                self.displayNotification({
                    title: _t("Multiple documents download feature isn't implemented yet.")
                })
            }
        },
        _onSidebarButtonShareClicked: function (event) {
            const self = this
            self._rpc({
                route: "/web/action/load",
                params: {
                    action_id: "dmedocument.dmedocument_action_document_share_wizard"
                }
            }).then(function (action) {
                if (!action) return
                action["context"] = JSON.parse(action["context"])
                action["context"]["default_document_ids"] = self.selected_document_ids
                self.do_action(action)
            })
        },
        _onSidebarButtonReplaceClicked: function (event) {
            const self = this
            if (self.selected_document_ids.length !== 1) return
            const document_id = self.selected_document_ids[0]

            const $formContainer = $(QWeb.render("dmedocument.dmedocument_template_document_upload", {
                fileupload_id: self.fileupload_id,
                csrf_token: WebCore.csrf_token,
                accepted_file_extensions: "*",
                fileupload_action: "/dmedocument/document/replace_content",
                document_id: document_id
            }))

            const $form = $formContainer.find(".dme-form-document-upload")
            $form.on("submit", function (submitEvent) {
                submitEvent.preventDefault()
                const form = submitEvent.currentTarget;
                fetch(form.action, {
                    method: form.method,
                    body: new FormData(form)
                }).then(function (response) {
                    $formContainer.remove()
                    self.trigger_up('reload', {keepChanges: true});
                    Framework.unblockUI()
                }, function (error) {
                    self.displayNotification({
                        title: error
                    })
                })
                Framework.blockUI()
            })

            const $input = $formContainer.find(".dme-input-document-upload")
            $input.on("change", function () {
                $form.submit()
            })

            self.$el.append($formContainer)
            $input.click()
        },
        _onSidebarButtonArchiveClicked: function (event) {
            const self = this
            self._rpc({
                model: "dmedocument.document",
                method: "archive_by_ids",
                args: [
                    self.selected_document_ids
                ]
            }).then(() => {
                self.selected_document_ids = []
                self.trigger_up("reload", {
                    keepChanges: true
                })
                self._renderSidebar()
            })
        },
        _onSidebarInputNameChanged: function (event) {
            const self = this
            if (self.selected_document_ids.length !== 1) return
            const document_id = self.selected_document_ids[0]
            const new_name = $(event.currentTarget).val()
            if (!new_name) return
            self._rpc({
                model: "dmedocument.document",
                method: "change_name",
                args: [
                    document_id,
                    new_name
                ]
            }).then(() => {
                self.trigger_up("reload", {
                    keepChanges: true
                })
            })
        },
        _onSidebarInputAppendTagChanged: function (event) {
            const self = this
            const tag_name = $(event.currentTarget).val()
            const tag = self.tags.find((tag) => tag.name === tag_name)
            if (!tag) return
            self._rpc({
                model: "dmedocument.document",
                method: "append_tag",
                args: [
                    self.selected_document_ids,
                    tag.id
                ]
            }).then(() => {
                self._onTagAppended(tag)
            })
        },
        _onSidebarInputWorkspaceChanged: function (event) {
            const self = this
            const workspace_name = $(event.currentTarget).val()
            const workspace = self.workspaces.find((workspace) => workspace.name === workspace_name)
            if (!workspace) return
            self._rpc({
                model: "dmedocument.document",
                method: "change_workspace",
                args: [
                    self.selected_document_ids,
                    workspace.id
                ]
            }).then(() => {
                self._onWorkspaceChanged(workspace)
            })
        },
        _onKanbanRendererCustomEventKanbanRecordSelected: function (event) {
            const document_id = event.data.document_id
            if (document_id) {
                if (this.selected_document_ids.includes(document_id)) {
                    this.selected_document_ids = this.selected_document_ids.filter((selected_document_id) => selected_document_id !== document_id)
                } else
                    this.selected_document_ids.push(document_id)
                this._renderSidebar()
            }
        },
        _onKanbanRendererCustomEventKanbanRecordSelectedOne: function (event) {
            const self = this
            const document_id = event.data.document_id
            if (document_id) {
                if(self.selected_document_ids.length !== 1 || self.selected_document_ids[0] !== document_id) {
                    self.selected_document_ids = [document_id]
                }
                else {
                    self.selected_document_ids = []
                    self.renderer.deselect(document_id)
                }
                this._renderSidebar()
            }
        },
        _onActionManagerCustomEventReselectMultiple: function(event) {
            const self = this
            const document_ids = event.data.document_ids
            if(document_ids) {
                self.selected_document_ids = document_ids
                self._renderSidebar()
                self.renderer.reselects(document_ids)
            }
        },
    })
    const KanbanRenderer = AbstractKanbanRenderer.extend({
        custom_events: _.extend({}, AbstractKanbanController.prototype.custom_events, {
            "dme-document-kanban-record-custom-event-select-one": "_onKanbanRecordCustomEventSelectedOne",
            "dme-document-kanban-record-custom-event-select": "_onKanbanRecordCustomEventSelected"
        }),
        config: _.extend({}, AbstractKanbanRenderer.prototype.config, {
            KanbanRecord: KanbanRecord
        }),
        init: function () {
            this._super.apply(this, arguments)
        },
        deselectsAll: function() {
            this.widgets.filter((widget) => widget.selected)
                .forEach((widget) => widget.deselect())
        },
        deselect: function(document_id) {
            if(!document_id) return
            const widget = this.widgets.find((widget) => widget.record.id.raw_value === document_id)
            if(widget)
                widget.deselect()
        },
        selects: function (document_ids) {
            if (!document_ids) return
            const selected_widgets = this.widgets.filter((widget) => !widget.selected && document_ids.includes(widget.record.id.raw_value))
            selected_widgets.forEach((widget) => widget.select())
        },
        reselects: function(document_ids) {
            console.log("KanbanRenderer: reselects")
            console.log(document_ids)
            const self = this
            if(!document_ids) return
            self.widgets.forEach((widget) => {
                if(document_ids.includes(widget.record.id.raw_value)){
                    if(!widget.selected)
                        widget.select()
                }
                else if(widget.selected)
                    widget.deselect()
            })
        },
        _onKanbanRecordCustomEventSelected: function (event) {
            const self = this
            const document_id = event.data.document_id
            if (document_id)
                self.trigger_up("dme-document-kanban-renderer-custom-event-kanban-record-select", {
                    document_id: document_id
                })
        },
        _onKanbanRecordCustomEventSelectedOne: function (event) {
            const self = this
            const document_id = event.data.document_id
            if (document_id) {
                self.widgets.forEach((widget) => {
                    if (widget.selected && widget.record.id.raw_value !== document_id)
                        widget.deselect()
                })
                self.trigger_up("dme-document-kanban-renderer-custom-event-kanban-record-select-one", {
                    document_id: document_id
                })
            }
        },
    })
    const KanbanView = AbstractKanbanView.extend({
        config: _.extend({}, AbstractKanbanView.prototype.config, {
            Controller: KanbanController,
            Renderer: KanbanRenderer
        })
    })

    ViewRegistry.add("dmedocument_kanban_view", KanbanView)

    return {
        dmedocument_kanban_view: KanbanView
    }
})