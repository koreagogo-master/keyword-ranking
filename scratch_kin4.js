import puppeteer from 'puppeteer';
import fs from 'fs';

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1');
    
    await page.goto('https://m.search.naver.com/search.naver?sm=mtb_hty.top&where=m_kin&ssc=tab.m_kin.all&query=인테리어', { waitUntil: 'networkidle2' });
    
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise(r => setTimeout(r, 1000));

    const data = await page.evaluate(() => {
        const allElements = document.querySelectorAll('*');
        const list = [];
        
        for (const el of Array.from(allElements)) {
            const text = el.textContent.trim();
            if (text.length < 2) continue; 
            
            const style = window.getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            
            if (rect.top > 0 && rect.top < 1500) {
                 list.push({
                    text: text.replace(/\n/g, ' '),
                    fontSize: parseFloat(style.fontSize),
                    y: Math.round(rect.top + window.scrollY),
                    tag: el.tagName
                });
            }
        }
        return list;
    });

    fs.writeFileSync('kin_dom_dump.json', JSON.stringify(data, null, 2));
    await browser.close();
})();
