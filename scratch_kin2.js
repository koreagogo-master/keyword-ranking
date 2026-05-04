import puppeteer from 'puppeteer';

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1');
    
    await page.goto('https://m.search.naver.com/search.naver?sm=mtb_hty.top&where=m_kin&ssc=tab.m_kin.all&query=인테리어', { waitUntil: 'networkidle2' });
    
    const data = await page.evaluate(() => {
        const lis = document.querySelectorAll('div.api_subject_bx ul > li, ._kinBase');
        const results = [];
        
        lis.forEach(li => {
            results.push(li.innerText.replace(/\n/g, ' || '));
        });
        
        return results;
    });

    console.log(JSON.stringify(data, null, 2));
    await browser.close();
})();
