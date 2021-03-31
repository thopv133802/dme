{
    "name": "DME Document",
    "summary": "DME Document Management",
    "description": "Manage your organization documents",
    "author": "DTQ",
    "version": "14.0.1",
    "application": True,
    "category": "Document",
    "depends": [
      "website", "web", "mail"
    ],
    "data": [
        "securities/groups.xml",
        "securities/ir.model.access.csv",
        "securities/record_rules.xml",
        "views/assets.xml",
        "views/actions.xml",
        "views/menus.xml",
        "views/templates.xml",
        "wizards/wizards.xml",
        "data/data.xml",
        "views/views.xml",
    ],
    "qweb": [
        "static/src/xml/*.xml"
    ]
}