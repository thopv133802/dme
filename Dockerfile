FROM odoo:14
USER root
RUN apt-get update && apt-get install -y libreoffice
RUN mkdir --parents /filestore/docx2pdf
RUN mkdir --parents /filestore/xlsx2pdf
RUN chmod -R 777 /filestore
COPY requirements.txt requirements.txt
RUN pip3 install -r requirements.txt
