// GESAGIS-only WeChat QR dialog. The general card QR remains independent.
const wechatDialog = document.querySelector('#wechat-dialog');
document.querySelectorAll('[data-open-wechat]').forEach(button => {
  button.addEventListener('click', () => {
    if (wechatDialog && !wechatDialog.open) wechatDialog.showModal();
  });
});
if (wechatDialog) {
  wechatDialog.addEventListener('click', event => {
    if (event.target === wechatDialog) wechatDialog.close();
  });
}
