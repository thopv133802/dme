from odoo import models, fields, api

class View(models.Model):
    _inherit = "ir.ui.view"
    type = fields.Selection(selection_add = [("m2m_group", "M2M Group")])

class ActWindowView(models.Model):
    _inherit = "ir.actions.act_window.view"
    view_mode = fields.Selection(selection_add = [("m2m_group", "M2M Group")], ondelete = {"m2m_group", "cascade"})

class Base(models.AbstractModel):
    _inherit = "base"

    @api.model
    def get_m2m_group_data(self, domain, m2m_field):
        records = self.search(domain)
        result_dict = {}
        for record in records:
            for m2m_record in record[m2m_field]:
                if m2m_record.id not in result_dict:
                    result_dict[m2m_record.id] = {
                        "name": m2m_record.display_name,
                        "children": [],
                        "model": m2m_record._name
                    }
                result_dict[m2m_record.id]["children"].append({
                    "name": record.display_name,
                    "id": record.id
                })