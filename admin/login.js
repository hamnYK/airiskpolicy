'use strict';
document.getElementById('login').onsubmit = async event => {
  event.preventDefault(); const form = event.currentTarget, button = form.querySelector('button'), message = document.getElementById('message');
  button.disabled = true; message.textContent = '로그인 확인 중…';
  try {
    const client = await window.aiRiskAdmin.client();
    const { error } = await client.auth.signInWithPassword({ email: form.elements.email.value.trim(), password: form.elements.password.value });
    if (error) throw Error(window.aiRiskAdmin.describe(error));
    try { await window.aiRiskAdmin.rpc('airisk_ontology_state'); }
    catch (error) { await client.auth.signOut({ scope: 'local' }); throw error; }
    location.replace('./');
  } catch (e) { message.textContent = e.message; form.elements.password.value = ''; }
  finally { button.disabled = false; }
};
