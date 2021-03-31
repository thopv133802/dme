/**********************************************************************************
*
*    Copyright (c) 2017-today MuK IT GmbH.
*
*    This file is part of MuK Grid Snippets
*    (see https://mukit.at).
*
*    This program is free software: you can redistribute it and/or modify
*    it under the terms of the GNU Lesser General Public License as published by
*    the Free Software Foundation, either version 3 of the License, or
*    (at your option) any later version.
*
*    This program is distributed in the hope that it will be useful,
*    but WITHOUT ANY WARRANTY; without even the implied warranty of
*    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
*    GNU Lesser General Public License for more details.
*
*    You should have received a copy of the GNU Lesser General Public License
*    along with this program. If not, see <http://www.gnu.org/licenses/>.
*
**********************************************************************************/

odoo.define('muk_web_theme.AppsMenu', function (require) {
"use strict";

const core = require('web.core');
const session = require("web.session");

const AppsMenu = require("web.AppsMenu");
const MenuSearchMixin = require("muk_web_theme.MenuSearchMixin");

AppsMenu.include(_.extend({}, MenuSearchMixin, {
    events: _.extend({}, AppsMenu.prototype.events, {
        "keydown .mk_search_input input": "_onSearchResultsNavigate",
        "click .mk_menu_search_result": "_onSearchResultChosen",
        "shown.bs.dropdown": "_onMenuShown",
        "hidden.bs.dropdown": "_onMenuHidden",
        "hide.bs.dropdown": "_onMenuHide",
        "click .btn-group-employee": "_onEmployeeGroupClicked",
        "click .btn-group-task-manager": "_onTaskManagerGroupClicked",
        "click .btn-group-customer-relationship": "_onCustomerRelationshipGroupClicked",
        "click .btn-group-marketing": "_onMarketingGroupClicked",
        "click .btn-group-product": "_onProductGroupClicked",
        "click .btn-left-sub-app-menu": "_onLeftSubAppMenuClicked"
    }),
    init(parent, menuData) {
        this._super(...arguments);
        for (let n in this._apps) {
            this._apps[n].web_icon_data = menuData.children[n].web_icon_data;
        }
        this._searchableMenus = _.reduce(
            menuData.children, this._findNames.bind(this), {}
        );
        this._search_def = $.Deferred();

        const self = this;

        self.dcsApps = self._apps.filter((app) => ["base.menu_management", "base.menu_administration"].includes(app.xmlID));
        self.mesApps = self._apps.filter((app) => ["mrp.menu_mrp_root", "maintenance.menu_maintenance_title"].includes(app.xmlID));

        let employeeGroupAppXmlIds = ["hr.menu_hr_root", "hr_recruitment.menu_hr_recruitment_root", "hr_holidays.menu_hr_holidays_root", "hr_expense.menu_hr_expense_root", "website_slides.website_slides_menu_root"]
        let documentManagerGroupApps = ["dmedocument.dmedocument_menu_root"];
        let taskManagerGroupAppXmlIds = ["project.menu_main_pm", "mail.menu_root_discuss"];
        let customerRelationshipGroupAppXmlIds = ["contacts.menu_contacts", "crm.crm_menu_root"]
        let marketingGroupAppXmlIds = ["mass_mailing.mass_mailing_menu_root", "website.menu_website_configuration"]
        let productGroupAppXmlIds = ["sale.sale_menu_root", "purchase.menu_purchase_root", "stock.menu_stock_root"]

        let erpAppXmlIds = [...employeeGroupAppXmlIds, ...documentManagerGroupApps, ...taskManagerGroupAppXmlIds, ...customerRelationshipGroupAppXmlIds, ...marketingGroupAppXmlIds, ...productGroupAppXmlIds]

        self.erpApps = self._apps.filter((app) => erpAppXmlIds.includes(app.xmlID));

        self.employeeGroupApps = self.erpApps.filter((app) => employeeGroupAppXmlIds.includes(app.xmlID));
        self.documentManagerGroupApps = self.erpApps.filter((app) => documentManagerGroupApps.includes(app.xmlID));
        self.taskManagerGroupApps = self.erpApps.filter((app) => taskManagerGroupAppXmlIds.includes(app.xmlID));
        self.customerRelationshipGroupApps = self.erpApps.filter((app) => customerRelationshipGroupAppXmlIds.includes(app.xmlID));
        self.marketingGroupApps = self.erpApps.filter((app) => marketingGroupAppXmlIds.includes(app.xmlID));
        self.productGroupApps = self.erpApps.filter((app) => productGroupAppXmlIds.includes(app.xmlID));
    },
    _onLeftSubAppMenuClicked(event) {
        event.stopPropagation()
        const self = this
        self.$mainContainer.find(".sub-menu-module-group").remove()
        self.$mainContainer.find(".module-big-group").attr("style", "display: initial")
    },
    _onEmployeeGroupClicked(event) {
        event.preventDefault()
        event.stopPropagation()
        const self = this
        self.$mainContainer.find(".module-big-group").attr("style", "display: none !important;")
        $(core.qweb.render("muk_web_theme.dme_sub_app_menu", {
            apps: self.employeeGroupApps
        })).appendTo(this.$mainContainer)
    },
    _onTaskManagerGroupClicked(event) {
        event.preventDefault()
        event.stopPropagation()

        const self = this
        self.$mainContainer.find(".module-big-group").attr("style", "display: none !important;")
        $(core.qweb.render("muk_web_theme.dme_sub_app_menu", {
            apps: self.taskManagerGroupApps
        })).appendTo(this.$mainContainer)
    },
    _onCustomerRelationshipGroupClicked(event) {
        event.preventDefault()
        event.stopPropagation()

        const self = this
        self.$mainContainer.find(".module-big-group").attr("style", "display: none !important;")
        $(core.qweb.render("muk_web_theme.dme_sub_app_menu", {
            apps: self.customerRelationshipGroupApps
        })).appendTo(this.$mainContainer)
    },
    _onMarketingGroupClicked(event) {
        event.preventDefault()
        event.stopPropagation()

        const self = this
        self.$mainContainer.find(".module-big-group").attr("style", "display: none !important;")
        $(core.qweb.render("muk_web_theme.dme_sub_app_menu", {
            apps: self.marketingGroupApps
        })).appendTo(this.$mainContainer)
    },
    _onProductGroupClicked(event) {
        event.preventDefault()
        event.stopPropagation()

        const self = this
        self.$mainContainer.find(".module-big-group").attr("style", "display: none !important;")
        $(core.qweb.render("muk_web_theme.dme_sub_app_menu", {
            apps: self.productGroupApps
        })).appendTo(this.$mainContainer)
    },
    start() {
        this._setBackgroundImage();
        this.$search_container = this.$(".mk_search_container");
        this.$search_input = this.$(".mk_search_input input");
        this.$search_results = this.$(".mk_search_results");
        this.$mainContainer = this.$(".main-container")
        return this._super(...arguments);
    },
    _onSearchResultChosen(event) {
        event.preventDefault();
        const $result = $(event.currentTarget),
            text = $result.text().trim(),
            data = $result.data(),
            suffix = ~text.indexOf("/") ? "/" : "";
        this.trigger_up("menu_clicked", {
            action_id: data.actionId,
            id: data.menuId,
            previous_menu_id: data.parentId,
        });
        const app = _.find(this._apps, (_app) => text.indexOf(_app.name + suffix) === 0);
        core.bus.trigger("change_menu_section", app.menuID);
    },
    _onAppsMenuItemClicked(event) {
    	this._super(...arguments);
    	event.preventDefault();
    },
    _setBackgroundImage() {
    	const url = session.url('/web/image', {
            model: 'res.company',
            id: session.company_id,
            field: 'background_image',
        });
        this.$('.dropdown-menu').css({
            "background-size": "cover",
            "background-image": "url(" + url + ")",
            "background-color": "#4a6572",
            "overflow-y": "scroll"
        });
        if (session.muk_web_theme_background_blend_mode) {
        	this.$('.o-app-name').css({
        		"mix-blend-mode": session.muk_web_theme_background_blend_mode,
        	});
        }
    },
    _onMenuHide(event) {
    	return $('.oe_wait').length === 0 && !this.$('input').is(':focus');
    },
}));

});