import jwt
from odoo import models, fields, api
from odoo.tools.translate import _, _logger


class DocumentRequest(models.TransientModel):
    _name = "dmedocument.document.request.wizard"
    _description = _("DME Document Request Wizard")

    name = fields.Char(string = _("Title"), required = True)
    def _default_workspace_id(self, *args):
        if "default_workspace_name" not in self._context:
            return False
        _logger.error(self._context)
        default_workspace_name = self._context["default_workspace_name"]
        workspace_id = self.env["dmedocument.workspace"].search([("name", "=like", default_workspace_name)], limit = 1)
        return workspace_id

    workspace_id = fields.Many2one("dmedocument.workspace", string = _("Workspace"), required = True, default = _default_workspace_id)
    tag_ids = fields.Many2many("dmedocument.tag", string = _("Tags"), domain = '[("workspace_id", "=", workspace_id)]')
    requested_user_id = fields.Many2one("res.users", string = "Request to", required = True)
    due_time = fields.Date(string = "Due time", required = True)
    note = fields.Char(string = _("Note"))

    @api.onchange("due_time")
    def _on_due_time_changed(self):
        if self.due_time and self.due_time < fields.Date.today():
            return {
                "warning": {
                    "title": _("Warning"),
                    "message": _("Due time has passed.")
                }
            }

    def request(self):
        document = self.env["dmedocument.document"].with_user(self.requested_user_id).create({
            "name": self.name,
            "workspace_id": self.workspace_id.id,
            "tag_ids": self.tag_ids.ids,
            "request_uid": self.env.uid,
            "document_type": "upload"
        })
        document.activity_schedule("mail.mail_activity_data_upload_document", self.due_time, user_id = self.requested_user_id.id, note = self.note)
        return {
            "type": "ir.actions.client",
            "tag": "close_dialog_and_refresh"
        }

class DocumentEdit(models.TransientModel):
    _name = "dmedocument.document.edit.wizard"
    _description = _("DME Document Edit Wizard")

    def _default_name(self):
        return self.env["dmedocument.document"].browse(self._context["active_id"]).name
    def _default_content(self):
        return self.env["dmedocument.document"].browse(self._context["active_id"]).content
    def _default_workspace_id(self):
        return self.env["dmedocument.document"].browse(self._context["active_id"]).workspace_id
    def _default_tag_ids(self):
        return self.env["dmedocument.document"].browse(self._context["active_id"]).tag_ids
    def _default_link(self):
        return self.env["dmedocument.document"].browse(self._context["active_id"]).link
    def _default_document_type(self):
        return self.env["dmedocument.document"].browse(self._context["active_id"]).document_type

    name = fields.Char(string = _("Title"), required = True, default = _default_name, readonly = True)
    content = fields.Binary(string = _("File"), default = _default_content)
    workspace_id = fields.Many2one("dmedocument.workspace", string = _("Workspace"), required = True, default = _default_workspace_id)
    link = fields.Char(string = _("Link"), default = _default_link)
    document_type = fields.Char(string = _("Document type"), default = _default_document_type, readonly = True)

    tag_ids = fields.Many2many(
        "dmedocument.tag",
        string = _("Tags"),
        domain = '[("workspace_id", "=", workspace_id)]',
        ondelete = "cascade",
        default = _default_tag_ids
    )

    def edit(self):
        self.env["dmedocument.document"].browse(self._context["default_document_id"]).write({
            "name": self.name,
            "content": self.content,
            "workspace_id": self.workspace_id,
            "tag_ids": self.tag_ids,
        })
        return {
            "type": "ir.actions.client",
            "tag": "close_dialog_and_refresh"
        }

class DocumentUpload(models.TransientModel):
    _name = "dmedocument.document.upload.wizard"
    _description = _("DME Document Upload Wizard")

    content = fields.Many2many("ir.attachment", string = _("Content"))

    def default_workspace_id(self, *args):
        if "default_workspace_name" not in self._context:
            return False
        default_workspace_name = self._context["default_workspace_name"]
        workspace_id = self.env["dmedocument.workspace"].search([("name", "=like", default_workspace_name)], limit = 1)
        return workspace_id

    workspace_id = fields.Many2one("dmedocument.workspace", string = _("Workspace"), required = True, default = default_workspace_id)

    tag_ids = fields.Many2many(
        "dmedocument.tag",
        string = _("Tags"),
        domain = '[("workspace_id", "=", workspace_id)]',
        ondelete = "cascade"
    )

    def upload(self):
        document_ids = self.env["dmedocument.document"].create([
            {
                "name": document.name,
                "content": document.datas,
                "workspace_id": self.workspace_id.id,
                "tag_ids": self.tag_ids.ids,
                "document_type": "file"
            }
            for document in self.content
        ])
        return {
            "type": "ir.actions.client",
            "tag": "close_dialog_and_refresh",
            "payload": document_ids.ids
        }

class DocumentAddLink(models.TransientModel):
    _name = "dmedocument.document.add.link.wizard"
    _description = _("DME Document Add Link Wizard")

    name = fields.Char(string = _("Title"), required = True)
    link = fields.Char(string = _("Link"), required = True)

    def default_workspace_id(self, *args):
        if "default_workspace_name" not in self._context:
            return False
        default_workspace_name = self._context["default_workspace_name"]
        workspace_id = self.env["dmedocument.workspace"].search([("name", "=like", default_workspace_name)], limit = 1)
        return workspace_id

    workspace_id = fields.Many2one("dmedocument.workspace", string = _("Workspace"), required = True, default = default_workspace_id)

    tag_ids = fields.Many2many(
        "dmedocument.tag",
        string = _("Tags"),
        domain = '[("workspace_id", "=", workspace_id)]',
        ondelete = "cascade"
    )

    def add_link(self):
        self.env["dmedocument.document"].create({
            "name": self.name,
            "link": self.link,
            "workspace_id": self.workspace_id.id,
            "tag_ids": self.tag_ids.ids,
            "document_type": "link"
        })
        return {
            "type": "ir.actions.client",
            "tag": "close_dialog_and_refresh"
        }

class DocumentShare(models.TransientModel):
    _name = "dmedocument.document.share.wizard"
    _description = _("DME Document Share")

    def _default_document_share(self, *args):
        if "active_id" in self._context and self._context["active_model"] == "dmedocument.document.share":
            return self._context["active_id"]
        document_share = self.env["dmedocument.document.share"].create({})
        document_share.link = self.env['ir.config_parameter'].sudo().get_param('web.base.url') + "/dmedocument/document?link=" + jwt.encode({"id": document_share.id}, "dme_dtq212_doanvananh0512_hangvu912", algorithm = "HS256")
        return document_share

    document_share_id = fields.Many2one("dmedocument.document.share", readonly = True, default = _default_document_share)
    link = fields.Char(string = _("Link"), related = "document_share_id.link", readonly = True)

    def _default_document_ids(self, *args):
        if "active_ids" in self._context and self._context["active_model"] == "dmedocument.document":
            return self._context["active_ids"]
        return False

    document_ids = fields.Many2many("dmedocument.document", string = _("Documents"), default = _default_document_ids)
    shared_user_ids = fields.Many2many("res.users", string = _("Users"))
    shared_group_ids = fields.Many2many("res.groups", string = _("Groups"))
    is_public = fields.Boolean(string = _("Share for all"), default = True)
    expired_date = fields.Date(string = _("Expired date"), default = fields.Date.today)

    @api.onchange("document_ids")
    def _on_document_ids_changed(self):
        self.document_share_id.document_ids = self.document_ids.ids
    @api.onchange("shared_user_ids")
    def _on_shared_user_ids_changed(self):
        self.document_share_id.shared_user_ids = self.shared_user_ids.ids
    @api.onchange("shared_group_ids")
    def _on_shared_group_ids_changed(self):
        self.document_share_id.shared_group_ids = self.shared_group_ids.ids
    @api.onchange("is_public")
    def _on_is_public_changed(self):
        self.document_share_id.is_public = self.is_public
    @api.onchange("expired_date")
    def _on_expired_date_changed(self):
        self.document_share_id.expired_date = self.expired_date