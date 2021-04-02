import base64
import io
import os
import re
import subprocess

from dateutil import parser
import humanize
import jwt
from werkzeug.exceptions import Forbidden, BadRequest, NotFound

from odoo import fields
from odoo.addons.web_editor.controllers.main import logger
from odoo.http import route, Controller, request

def docx2pdf_linux(docx_file_name, docx2pdf_folder, timeout = None):
    input_file_path = "{}/{}".format(docx2pdf_folder, docx_file_name)
    cmd = "/usr/bin/libreoffice --headless --convert-to pdf --outdir /filestore/docx2pdf".split() + [input_file_path]
    process = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout = timeout)
    process_output = process.stdout.decode()
    output_file_path = re.search('-> (.*?) using filter', process_output).group(1)
    file = open(output_file_path, "rb")
    file_content = file.read()
    file.close()
    os.remove(input_file_path)
    os.remove(output_file_path)
    return file_content
def xlsx2pdf_linux(xlsx_file_name, xlsx2pdf_folder, timeout = None):
    input_file_path = "{}/{}".format(xlsx2pdf_folder, xlsx_file_name)
    cmd = "/usr/bin/libreoffice --headless --convert-to pdf --outdir /filestore/xlsx2pdf".split() + [input_file_path]
    process = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout = timeout)
    process_output = process.stdout.decode()
    output_file_path = re.search('-> (.*?) using filter', process_output).group(1)
    file = open(output_file_path, "rb")
    file_content = file.read()
    file.close()
    os.remove(input_file_path)
    os.remove(output_file_path)
    return file_content
class Main(Controller):
    @route("/dmedocument/document/document_size/<int:document_id>", type = "json", auth = "user")
    def document_size(self, document_id):
        document = request.env["dmedocument.document"].search([("id", "=", document_id)], limit = 1)
        if not document:
            return NotFound("Document doesn't exists.")
        if document.content:
            return len(document.content)
        elif document.spreadsheet_content:
            return len(document.spreadsheet_content)
        else:
            return BadRequest("Document is empty.")

    @route("/dmedocument/document/document_viewable/<int:document_id>", type = "json", auth = "user")
    def document_viewable(self, document_id):
        document = request.env["dmedocument.document"].search([("id", "=", document_id)], limit = 1)
        if not document:
            return NotFound("Document doesn't exists.")
        if document.content:
            return [len(document.content) < 5_000_000, "Too large"]
        elif document.spreadsheet_content:
            return [len(document.spreadsheet_content) < 5_000_000, "Too large"]
        else:
            return [False, ]

    @route("/dmedocument/document/docx2pdf/<int:document_id>", type = "http", auth = "user")
    def docx2pdf(self, document_id):
        document = request.env["dmedocument.document"].search([("id", "=", document_id)], limit = 1)
        if not document:
            return NotFound("Document doesn't exists.")
        if not document.content:
            return BadRequest("Document is empty.")
        if document.icon not in ["doc", "docx"]:
            return BadRequest("Document isn't in docx format")
        if len(document.content) > 5_000_000:
            return BadRequest("Document size is too large to be previewed")
        content = base64.b64decode(document.content)
        docx2pdf_folder = "/filestore/docx2pdf"
        os.makedirs(docx2pdf_folder, exist_ok = True)
        docx_file_name = "docx_{}.docx".format(document_id)
        file = open("{}/{}".format(docx2pdf_folder, docx_file_name), "wb")
        file.write(content)
        file.close()
        pdf = docx2pdf_linux(docx_file_name, docx2pdf_folder)
        return request.make_response(pdf, headers = [
            ("Content-Length", len(pdf))
        ])
    @route("/dmedocument/document/xlsx2pdf/<int:document_id>", type = "http", auth = "user")
    def xlsx2pdf(self, document_id):
        document = request.env["dmedocument.document"].search([("id", "=", document_id)], limit = 1)
        if not document:
            return NotFound("Document doesn't exists.")
        if not document.content:
            return BadRequest("Document is empty.")
        if document.icon not in ["xls", "xlsx"]:
            return BadRequest("Document isn't in xlsx format")
        if len(document.content) > 5_000_000:
            return BadRequest("Document size is too large to be previewed")
        content = base64.b64decode(document.content)
        xlsx2pdf_folder = "/filestore/xlsx2pdf"
        os.makedirs(xlsx2pdf_folder, exist_ok = True)
        xlsx_file_name = "xlsx_{}.xlsx".format(document_id)
        file = open("{}/{}".format(xlsx2pdf_folder, xlsx_file_name), "wb")
        file.write(content)
        file.close()
        pdf = xlsx2pdf_linux(xlsx_file_name, xlsx2pdf_folder)
        return request.make_response(pdf, headers = [
            ("Content-Length", len(pdf))
        ])

    @route("/dmedocument/document/permission/upload", type = "json", auth = "user")
    def permission_upload(self, document_id):
        document = request.env["dmedocument.document"].search([("id", "=", document_id)], limit = 1)
        if not document:
            return[False, "Document {} doesn't exists.".format(document_id)]
        upload_document_activities = document.activity_ids.filtered_domain([("can_write", "=", True), ("activity_category", "=like", "upload_file")])
        if not upload_document_activities:
            return [False, "Current user doesn't have permission to upload document."]
        return [True, ""]
    @route("/dmedocument/document/spreadsheet_content", type = "json", auth = "user")
    def document_spreadsheet_content(self, document_id):
        document = request.env["dmedocument.document"].search([("id", "=", document_id)], limit = 1)
        if not document:
            return[False, "Document {} doesn't exists.".format(document_id)]
        return [True, document.spreadsheet_content]
    @route("/dmedocument/document", type = "http", auth = "public", website = True)
    def document(self, link):
        infos = jwt.decode(link, "dme_dtq212_doanvananh0512_hangvu912", algorithms = ["HS256"])
        if not infos or "id" not in infos:
            return BadRequest("Link is invalid.")
        document_share_id = infos["id"]
        document_share = request.env["dmedocument.document.share"].sudo().search([("id", "=", document_share_id)], limit = 1)
        if not document_share:
            return NotFound("Document share doesn't exists.")
        if document_share.expired_date < fields.Date.today():
            return BadRequest("Link already expired.")
        has_permission = False
        if document_share.is_public:
            has_permission = True
        else:
            current_user_id = request.uid
            current_group_ids = request.env["res.users"].sudo().search([("id", "=", current_user_id)], limit = 1).groups_id.ids
            allowed_user_ids = document_share.shared_user_ids.ids + [document_share.create_uid.id]
            allowed_group_ids = document_share.shared_group_ids.ids
            group_intersect = set(current_group_ids) & set(allowed_group_ids)
            if current_user_id in allowed_user_ids or len(group_intersect) > 0:
                has_permission = True
        if has_permission:
            documents = document_share.document_ids
            if not documents:
                return BadRequest("There are no shared documents.")

            documents = [{
                "document_id": document.id,
                "document_name": document.name,
                "document_icon": document.icon,
                "document_owner": document.create_uid.name,
                "document_type": document.document_type,
                "document_size": self._compute_document_size(document),
                "document_create_date": parser.parse(str(document.create_date)).date(),
                "document_link": document.link,
                "document_requester": document.request_uid.name if document.request_uid else "",
                "document_spreadsheet_content": document.spreadsheet_content or "[{}]"
            } for document in documents]

            return request.render("dmedocument.document_share_template", {
                "documents": documents,
                "document_share_sharer": document_share.create_uid.name,
                "document_share_create_date": parser.parse(str(document_share.create_date)).date(),
                "document_share_expired_date": document_share.expired_date
            })
        return Forbidden("Permission denied.")

    def _compute_document_size(self, document):
        if not document:
            return humanize.naturalsize(0)
        if document.document_type == "file" and document.content:
            return humanize.naturalsize(len(document.content) * 3 / 4)
        if document.document_type == "spreadsheet" and document.spreadsheet_content:
            return humanize.naturalsize(len(document.spreadsheet_content))
        return humanize.naturalsize(0)

    @route("/dmedocument/document/fill", type = "http", auth = "user")
    def document_fill(self, document_id, ufile):
        document = request.env["dmedocument.document"].search([("id", "=", document_id)], limit = 1)
        if not document:
            error_message = "<p>Failed</p> Document {} doesn't exists.".format(document_id)
            logger.error(error_message)
            return BadRequest(error_message)

        upload_document_activities = document.activity_ids.filtered_domain([("can_write", "=", True), ("activity_category", "=like", "upload_file")])
        if not upload_document_activities:
            error_message = "<p>Failed</p> There are no upload_document can_write activities available."
            logger.error(error_message)
            return BadRequest(error_message)
        upload_document_activity = upload_document_activities[-1]
        document.content = base64.encodebytes(ufile.read())
        document.name = ufile.filename
        upload_document_activity.unlink()
        message_upload_document_done = request.env["mail.message"].create({
            "body": "Upload document done",
            "message_type": "comment"
        })
        if message_upload_document_done:
            document.message_ids |= message_upload_document_done
        return "<p>Success</p>"