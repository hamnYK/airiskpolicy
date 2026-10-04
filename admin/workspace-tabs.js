'use strict';
(()=>{
 const tabs=[...document.querySelectorAll('[data-admin-workspace]')],frame=document.getElementById('weekly-frame');let observer;
 window.aiRiskPositionConfirmation=dialog=>{const top=Math.max(16,16-frame.getBoundingClientRect().top);Object.assign(dialog.style,{top:top+'px',bottom:'auto',marginTop:'0',marginBottom:'0',maxHeight:Math.max(200,innerHeight-32)+'px'});};
 frame.addEventListener('load',()=>{
  observer?.disconnect();const main=frame.contentDocument?.querySelector('main');if(!main)return;
  const fit=()=>{if(main.getBoundingClientRect().width>0)frame.style.height=Math.max(640,Math.ceil(main.getBoundingClientRect().height)+24)+'px';};
  observer=new ResizeObserver(fit);observer.observe(main);fit();
 });
 function activate(name){
  for(const tab of tabs){const active=tab.dataset.adminWorkspace===name;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;document.getElementById(tab.getAttribute('aria-controls')).hidden=!active;}
  if(name==='weekly'&&!frame.getAttribute('src'))frame.src='weekly.html?embedded=1';
 }
 for(const tab of tabs){tab.onclick=()=>activate(tab.dataset.adminWorkspace);tab.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?tabs[0]:e.key==='End'?tabs[1]:tabs.find(x=>x!==tab);activate(next.dataset.adminWorkspace);next.focus();}};}
})();
