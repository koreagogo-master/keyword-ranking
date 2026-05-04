import puppeteer from 'puppeteer';

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    // Simulate mobile
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1');
    
    await page.goto('https://m.search.naver.com/search.naver?sm=mtb_hty.top&where=m_kin&ssc=tab.m_kin.all&query=인테리어', { waitUntil: 'networkidle2' });
    
    const data = await page.evaluate(() => {
        const results = [];
        const items = document.querySelectorAll('div.api_subject_bx ul > li, ._kinBase');
        
        // Alternatively, use heuristic
        const allElements = document.querySelectorAll('*');
        const list = [];
        for(let el of allElements) {
            const text = el.textContent.trim();
            if(!text || text.length < 2) continue;
            const style = window.getComputedStyle(el);
            list.push({
                text: text,
                fontSize: parseFloat(style.fontSize),
                color: style.color,
                tagName: el.tagName,
                className: el.className,
                href: el.closest('a') ? el.closest('a').href : null
            });
        }
        return list.slice(0, 100);
    });

    console.log(JSON.stringify(data.filter(d => d.text.includes('인테리어')), null, 2).substring(0, 2000));
    await browser.close();
})();
