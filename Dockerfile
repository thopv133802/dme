FROM odoo:14
COPY requirements.txt requirements.txt
RUN pip3 install -r requirements.txt