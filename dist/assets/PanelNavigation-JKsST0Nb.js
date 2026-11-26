import{c as p,r as o,j as a}from"./index-ciICD_y4.js";/**
 * @license lucide-react v0.460.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const v=p("Plus",[["path",{d:"M5 12h14",key:"1ays0h"}],["path",{d:"M12 5v14",key:"s699le"}]]);/**
 * @license lucide-react v0.460.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const m=p("Trash2",[["path",{d:"M3 6h18",key:"d0wm0j"}],["path",{d:"M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6",key:"4alrt4"}],["path",{d:"M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2",key:"v07s0e"}],["line",{x1:"10",x2:"10",y1:"11",y2:"17",key:"1uufr5"}],["line",{x1:"14",x2:"14",y1:"11",y2:"17",key:"xtxkd"}]]);function y({label:n,current:l,items:r,onSelect:c,action:d}){const h=o.useId();return a.jsxs("aside",{className:"panel-sidebar",children:[a.jsx("p",{className:"panel-nav-heading",children:n}),a.jsx("nav",{className:"panel-nav-list","aria-label":n,children:r.map(({id:e,label:i,icon:s,count:t})=>a.jsxs("button",{type:"button",className:`panel-nav-btn ${e===l?"active":""}`,"aria-current":e===l?"page":void 0,onClick:()=>c(e),children:[s,a.jsx("span",{children:i}),t!==void 0&&a.jsx("small",{className:"panel-nav-count",style:t>0?{background:"#10B981",color:"#FFFFFF",fontWeight:800,minWidth:22,height:22,padding:"0 7px",borderRadius:999,display:"inline-flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 0 3px rgba(16, 185, 129, 0.22)"}:void 0,children:t})]},e))}),a.jsxs("div",{className:"panel-nav-picker",children:[a.jsx("label",{htmlFor:h,children:n}),a.jsx("select",{id:h,value:l,onChange:e=>c(e.target.value),children:r.map(({id:e,label:i,count:s})=>a.jsxs("option",{value:e,children:[i,s!==void 0?` (${s})`:""]},e))})]}),d&&a.jsx("div",{className:"panel-nav-footer",children:d})]})}export{y as P,m as T,v as a};
