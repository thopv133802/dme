import base64
import random
from datetime import timedelta
from mimetypes import guess_type

import jwt

from odoo import models, fields, api, exceptions
from odoo.tools.translate import _, _logger
import html2text

import os

class DocumentWorkSpace(models.Model):
    _name = "dmedocument.workspace"
    _description = _("DME Document Workspace")
    _sql_constraints = [
        ("name_uniq", "unique(name)", _("Workspace name must be unique")),
    ]
    name = fields.Char(string = _("Name"), translate = True, required = True)

    category_ids = fields.One2many("dmedocument.tag.category", inverse_name = "workspace_id", string = "Tag categories", )

    read_group_ids = fields.Many2many("res.groups", relation = "workspace_readgroups", string = _("Read groups"))
    write_group_ids = fields.Many2many("res.groups", relation = "workspace_writegroups", string = _("Write groups"))

    read_record_rule_id = fields.Many2one("ir.rule", invisible = True, compute = "_compute_read_record_rules", store = True)
    write_record_rule_id = fields.Many2one("ir.rule", invisible = True, compute = "_compute_write_record_rules", store = True)

    document_read_record_rule_id = fields.Many2one("ir.rule", invisible = True, compute = "_compute_read_record_rules", store = True)
    document_write_record_rule_id = fields.Many2one("ir.rule", invisible = True, compute = "_compute_write_record_rules", store = True)

    document_count = fields.Integer(compute = "_compute_document_count")

    def _compute_document_count(self):
        for record in self:
            record.document_count = self.env["dmedocument.document"].search_count([("workspace_id", "=", self.id)])

    @api.depends("read_group_ids")
    def _compute_read_record_rules(self):
        admin_group_id = self.env.ref("dmedocument.dmedocument_group_admin").id
        for record in self:
            group_ids = {admin_group_id}
            if record.read_group_ids:
                group_ids |= set(record.read_group_ids.ids)
            if not record.read_record_rule_id:
                record.read_record_rule_id = self.env["ir.rule"].sudo().create({
                    "name": "Read record rule of workspace: {}".format(record.name),
                    "model_id": self.env.ref("dmedocument.model_dmedocument_workspace").id,
                    "groups": [(6, 0, group_ids)],
                    "domain_force": '[("id", "=", {})]'.format(record.id),
                    "perm_read": True,
                    "perm_write": False,
                    "perm_create": False,
                    "perm_unlink": False
                })
            else:
                record.sudo().read_record_rule_id.groups = [(6, 0, group_ids)]

            if not record.document_read_record_rule_id:
                record.document_read_record_rule_id = self.env["ir.rule"].sudo().create({
                    "name": "Document read record rule of workspace: {}".format(record.name),
                    "model_id": self.env.ref("dmedocument.model_dmedocument_document").id,
                    "groups": [(6, 0, group_ids)],
                    "domain_force": '[("workspace_id", "=", {})]'.format(record.id),
                    "perm_read": True,
                    "perm_write": False,
                    "perm_create": False,
                    "perm_unlink": False
                })
            else:
                record.sudo().document_read_record_rule_id.groups = [(6, 0, group_ids)]

        self.env["ir.rule"].sudo().clear_cache()
    @api.depends("write_group_ids")
    def _compute_write_record_rules(self):
        admin_group_id = self.env.ref("dmedocument.dmedocument_group_admin").id
        for record in self:
            group_ids = {admin_group_id}
            if record.write_group_ids:
                group_ids |= set(record.write_group_ids.ids)
            if not record.write_record_rule_id:
                record.write_record_rule_id = self.env["ir.rule"].sudo().create({
                    "name": "Write record rule of workspace: {}".format(record.name),
                    "model_id": self.env.ref("dmedocument.model_dmedocument_workspace").id,
                    "groups": [(6, 0, group_ids)],
                    "domain_force": '[("id", "=", {})]'.format(record.id),
                    "perm_read": True,
                    "perm_write": False,
                    "perm_create": False,
                    "perm_unlink": False
                })
            else:
                record.sudo().write_record_rule_id.groups = [(6, 0, group_ids)]

            if not record.document_write_record_rule_id:
                record.document_write_record_rule_id = self.env["ir.rule"].sudo().create({
                    "name": "Document write record rule of workspace: {}".format(record.name),
                    "model_id": self.env.ref("dmedocument.model_dmedocument_document").id,
                    "groups": [(6, 0, group_ids)],
                    "domain_force": '["&", ("workspace_id", "=", {}), ("create_uid", "=", user.id)]'.format(record.id),
                    "perm_read": False,
                    "perm_write": True,
                    "perm_create": True,
                    "perm_unlink": True
                })
            else:
                record.sudo().document_write_record_rule_id.groups = [(6, 0, group_ids)]

        # self.env["ir.rule"].sudo().clear_cache()

    def unlink(self):
        rule_names = ["Read record rule of workspace: {}".format(workspace_id) for workspace_id in self.mapped("name")] \
                    + ["Write record rule of workspace: {}".format(workspace_id) for workspace_id in self.mapped("name")] \
                    + ["Document read record rule of workspace: {}".format(workspace_id) for workspace_id in self.mapped("name")] \
                    + ["Document write record rule of workspace: {}".format(workspace_id) for workspace_id in self.mapped("name")]

        _logger.error(rule_names)

        rule_ids = self.env["ir.rule"].sudo().search([("name", "in", rule_names)]).ids
        if super(DocumentWorkSpace, self).unlink():
            self.env["ir.rule"].sudo().search([("id", "in", rule_ids)]).unlink()

class DocumentTagCategory(models.Model):
    _name = "dmedocument.tag.category"
    _description = _("DME Document Tag Category")
    _order = "sequence asc"

    name = fields.Char(string = _("Name"), translate = True, required = True)
    sequence = fields.Integer(string = _("Sequence"), default = 100)
    workspace_id = fields.Many2one("dmedocument.workspace", string = _("Workspace"))
    tag_ids = fields.One2many("dmedocument.tag", inverse_name = "category_id", string = "Tags")

class DocumentTag(models.Model):
    _name = "dmedocument.tag"
    _description = _("DME Document Tag")
    _order = "category_sequence,sequence asc"

    name = fields.Char(string = _("Name"), translate = True, required = True)
    sequence = fields.Integer(string = _("Sequence"), default = 100)
    category_id = fields.Many2one("dmedocument.tag.category", string = _("Category"))
    category_sequence = fields.Integer(compute = "_compute_category_sequence", store = True, invisible = True)
    workspace_id = fields.Many2one("dmedocument.workspace", string = _("Workspace"), readonly = True, compute = "_compute_workspace_id", store = True, ondelete = "cascade")


    def name_get(self):
        expand = "expand" in self._context and self._context["expand"]
        if not self or not expand:
            return super(DocumentTag, self).name_get()
        names = []
        for record in self:
            names.append((record.id,  (record.category_id.name + " > " if record.category_id else "") + record.name))
        return names


    @api.depends("category_id")
    def _compute_category_sequence(self):
        for record in self:
            record.category_sequence = record.category_id.sequence

    @api.depends("category_id")
    def _compute_workspace_id(self):
        for record in self:
            record.workspace_id = record.category_id.workspace_id.id

    @api.model
    def _get_default_color(self):
        return random.randint(1, 11)
    color = fields.Integer(default = _get_default_color)


class Document(models.Model):
    _inherit = ["mail.thread", "mail.activity.mixin"]
    _name = "dmedocument.document"
    _description = _("DME Document")

    name = fields.Char(string = _("Title"), required = True)
    document_type = fields.Selection([
        ("upload", _("Upload")),
        ("link", _("Link")),
        ("file", _("File")),
        ("spreadsheet", _("Spreadsheet"))
    ], default = "upload", compute = "_compute_document_type", store = True)
    icon = fields.Char(compute = "_compute_icon", store = True, invisible = True)

    file_name = fields.Char(string = _("File name"), invisible = True)
    content = fields.Binary(compute = "_compute_content", store = True, string = _("Content"))

    link = fields.Char(string = _("Link"))

    request_uid = fields.Many2one("res.users", string = _("Requester"))

    spreadsheet_content = fields.Text(string = _("Spreadsheet"))

    @api.depends("message_ids")
    def _compute_content(self):
        for record in self:
            name = record.name
            file_name = record.file_name
            content = record.content
            document_type = record.document_type

            if not record.content and record.document_type == "upload":
                if record.message_ids and len(record.message_ids) >= 2:
                    upload_message = record.message_ids[-2]
                    if upload_message.attachment_ids:
                        attachment_id = upload_message.attachment_ids[0]
                        if attachment_id.datas:
                            content = attachment_id.datas
                            file_name = attachment_id.name
                            document_type = "file"
                            if not record.name:
                                name = attachment_id.name
                            attachment_id.unlink()

            record.name = name
            record.file_name = file_name
            record.content = content
            record.document_type = document_type

    active = fields.Boolean(string = _("Active"), default = True)

    def _compute_permission_write(self):
        allowed_records = self._filter_access_rules("write")
        for record in allowed_records:
            record.permission_write = True
        for record in self - allowed_records:
            record.permission_write = False
    permission_write = fields.Boolean(compute = "_compute_permission_write")

    def _compute_permission_unlink(self):
        allowed_records = self._filter_access_rules("unlink")
        for record in allowed_records:
            record.permission_unlink = True
        for record in self - allowed_records:
            record.permission_unlink = False
    permission_unlink = fields.Boolean(compute = "_compute_permission_unlink")

    FILE_EXTENTIONS = ['raw', 'html', 'ps', 'php', 'txt', 'fla', 'css', 'zip', 'sql', 'xlsx', 'dat', 'mp3', 'indd', 'xls', 'cdr', 'iso', 'none', 'avi', 'js', 'xml', 'jpg', 'wmv', 'dmg', 'pdf', 'ppt', 'flv', 'bmp', 'svg', 'mpg', 'midi', 'png', 'tif', 'dll', 'ai', 'aac', 'gif', 'jpeg', 'doc', 'mov', 'eps', 'psd', '3ds', 'cad']

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

    @api.depends("document_type")
    def _compute_icon(self):
        for record in self:
            #Compute icon
            if record.document_type == "upload":
                record.icon = "upload"
            elif record.document_type == "link":
                record.icon = "link"
            elif record.document_type == "spreadsheet":
                record.icon = "spreadsheet"
            elif record.document_type == "file":
                file_name_split = record.file_name.split(".")
                has_extension = len(file_name_split) > 1
                if not has_extension:
                    record.icon = "none"
                else:
                    file_extension = file_name_split[-1]
                    if file_extension not in self.FILE_EXTENTIONS:
                        record.icon = "none"
                    record.icon = file_extension
            else:
                record.icon = "none"
    def archive(self):
        self.active = False

    def un_archive(self):
        self.active = True

class DocumentShare(models.Model):
    _name = "dmedocument.document.share"
    _description = _("DME Document Share")


    document_ids = fields.Many2many("dmedocument.document", string = _("Documents"))
    shared_user_ids = fields.Many2many("res.users", string = _("Users"))
    shared_group_ids = fields.Many2many("res.groups", string = _("Groups"))
    link = fields.Char(string = _("Link"), readonly = True)
    is_public = fields.Boolean(string = _("Share for all"))
    expired_date = fields.Date(string = _("Expired date"))
    current_date = fields.Date(compute = "_compute_current_date")

    def _compute_current_date(self):
        for record in self:
            record.current_date = fields.Date.today()