import puppeteer from 'puppeteer';

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1');
    
    await page.goto('https://m.search.naver.com/search.naver?sm=mtb_hty.top&where=m_kin&ssc=tab.m_kin.all&query=인테리어', { waitUntil: 'networkidle2' });
    
    // Expand to get real dimensions
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise(r => setTimeout(r, 1000));

    const data = await page.evaluate(() => {
        const allElements = document.querySelectorAll('*');
        const list = [];
        let titleCount = 0;
        
        for (const el of Array.from(allElements)) {
            if (el.offsetParent === null) continue;
            
            const text = el.textContent.trim();
            if (text.length < 2) continue; 
            if (list.some(i => i.element === el)) continue;

            const style = window.getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            
            const fontSize = parseFloat(style.fontSize);
            
            if (rect.top > 0 && rect.top < 2000) {
                 list.push({
                    text: text.substring(0, 50).replace(/\n/g, ' '),
                    fontSize,
                    y: rect.top + window.scrollY,
                    tagName: el.tagName
                });
            }
        }
        
        // Remove duplicates and sort
        const unique = [];
        const seen = new Set();
        for (const item of list) {
            const key = item.text + Math.round(item.y);
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(item);
            }
        }
        
        return unique.sort((a,b) => a.y - b.y);
    });

    console.log(JSON.stringify(data.filter(d => ['A', 'SPAN', 'DIV', 'STRONG', 'MARK'].includes(d.tagName)), null, 2).substring(0, 3000));
    await browser.close();
})();
