const apiKey = 'sk-2O04QeXHCP9O6Xvg2aVU52rcxihlAM6IJoGd99MIvC0HZv4I';
const res = await fetch('https://api.moonshot.cn/v1/chat/completions', {
    method: 'POST',
    headers: { 
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        model: 'moonshot-v1-8k',
        messages: [{ role: 'user', content: 'hello' }]
    })
});
console.log(res.status, await res.text());
