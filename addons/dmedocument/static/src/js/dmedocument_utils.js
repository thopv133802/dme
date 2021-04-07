odoo.define("dmedocument.Utils", (require) => {
    "use strict"
    const Utils = {
        xtos: function (sdata) {
            const out = XLSX.utils.book_new();
            sdata.forEach(function (xws) {
                const aoa = [[]];
                const rowobj = xws.rows;
                for (let ri = 0; ri < rowobj.len; ++ri) {
                    const row = rowobj[ri];
                    if (!row) continue;
                    aoa[ri] = [];
                    Object.keys(row.cells).forEach(function (k) {
                        const idx = +k;
                        if (isNaN(idx)) return;
                        aoa[ri][idx] = row.cells[k].text;
                    });
                }
                const ws = XLSX.utils.aoa_to_sheet(aoa);
                XLSX.utils.book_append_sheet(out, ws, xws.name);
            });
            return out;
        },
        configInputWithDatalist: function($input) {
            $input.on("click focus", () => {
                const oldValue = $input.val()
                $input.on("mouseleave", () => {
                    const newValue = $input.val()
                    if(!newValue) {
                        $input.val(oldValue)
                    }
                    $input.off("mouseleave")
                })
                $input.val("")
            })
        },
        intersects: function(arrays) {
            let  min_length_array = arrays[0]
            for (let i = 0; i < arrays.length; i++) {
                if(min_length_array.length > arrays[i].length)
                    min_length_array = arrays[i]
            }
            // const min_length_array = _.minBy(arrays, (array) => array.length)
            return min_length_array.filter((element) => {
                return arrays.every((array) => array.includes(element))
            })
        },
        extractCurrentWorkspace: function() {
            const $workspace_container = document.querySelector(".list-group-item-action.active")
            return $workspace_container ? $workspace_container.textContent : false
        }
    }
    return Utils
})