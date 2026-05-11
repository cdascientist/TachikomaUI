const apiKey = 'sk-2O04QeXHCP9O6Xvg2aVU52rcxihlAM6IJoGd99MIvC0HZv4I';
const res = await fetch('https://api.moonshot.cn/v1/models', {
    headers: { 'Authorization': `Bearer ${apiKey}` }
});
console.log(res.status, await res.text());
