const fs = require('fs');

async function generateRss() {
    try {
        console.log("מתחיל למשוך את קוד ה-HTML מהאתר...");
        
        const response = await fetch('https://www.sipurderech.co.il/%D7%99%D7%A9%D7%A8%D7%9A%D7%9C', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7'
            }
        });

        if (!response.ok) {
            throw new Error(`השרת החזיר שגיאת סטטוס: ${response.status} ${response.statusText}`);
        }

        const html = response.text();
        console.log(`ה-HTML ירד בהצלחה. גודל: ${html.length} תווים.`);

        let articlesData = null;

        // --- ניסיון 1: חילוץ דרך __NEXT_DATA__ (המקור האמין ביותר ב-Next.js) ---
        const nextDataRegex = /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/;
        const nextDataMatch = html.match(nextDataRegex);
        
        if (nextDataMatch) {
            try {
                console.log("נמצאה תגית __NEXT_DATA__, מנסה לחלץ נתונים...");
                const nextJson = JSON.parse(nextDataMatch[1].trim());
                
                // ניווט דינמי בתוך ה-Props של Next.js כדי למצוא את רשימת המאמרים
                // המבנה לרוב נמצא תחת pageProps
                const pageProps = nextJson.props?.pageProps;
                if (pageProps) {
                    // מחפש מערך שמכיל אובייקטים עם שדות כמו url או name
                    const possibleLists = Object.values(pageProps).find(val => Array.isArray(val) && val.length > 0 && (val[0].url || val[0].name));
                    if (possibleLists) {
                        articlesData = possibleLists.map(item => ({
                            name: item.name || item.title,
                            url: item.url ? (item.url.startsWith('http') ? item.url : `https://www.sipurderech.co.il${item.url}`) : ''
                        })).filter(item => item.name && item.url);
                        console.log(`הנתונים חולצו בהצלחה מ-__NEXT_DATA__ (נמצאו ${articlesData.length} פריטים).`);
                    }
                }
            } catch (e) {
                console.log("הניסיון לחלץ מ-__NEXT_DATA__ נכשל, עובר לניסיון הבא...");
            }
        }

        // --- ניסיון 2: חילוץ מרוכך מתוך תגיות ה-Schema (אם ניסיון 1 נכשל) ---
        if (!articlesData) {
            console.log("מנסה חילוץ מרוכך מתגיות application/ld+json...");
            const schemaRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g;
            let match;

            while ((match = schemaRegex.exec(html)) !== null) {
                try {
                    const cleanJsonText = match[1].replace(/[\u200B-\u200D\uFEFF]/g, '').trim(); // ניקוי תווים נסתרים
                    const json = JSON.parse(cleanJsonText);
                    
                    const target = Array.isArray(json) ? json.find(obj => obj['@type'] === 'ItemList') : (json['@type'] === 'ItemList' ? json : null);
                    
                    if (target && target.itemListElement) {
                        articlesData = target.itemListElement.map(item => ({
                            name: item.name,
                            url: item.url
                        }));
                        console.log(`הנתונים חולצו בהצלחה מה-Schema (נמצאו ${articlesData.length} פריטים).`);
                        break;
                    }
                } catch (e) {
                    // המשך ללולאה הבאה
                }
            }
        }

        // --- בדיקת בטיחות סופית ---
        if (!articlesData || articlesData.length === 0) {
            console.log("הצצה לתוכן ה-HTML שהתקבל (תווים 1000-2000):");
            console.log(html.substring(1000, 2000));
            throw new Error("לא נמצאו נתוני מסלולים באף אחד מהמקורות בדף.");
        }

        // 3. בניית ה-XML של ה-RSS
        let rssItems = '';
        articlesData.forEach(item => {
            const pubDate = new Date().toUTCString();
            rssItems += `
        <item>
            <title><![CDATA[${item.name}]]></title>
            <link>${item.url}</link>
            <guid isPermaLink="true">${item.url}</guid>
            <pubDate>${pubDate}</pubDate>
            <description><![CDATA[מסלול חדש: ${item.name}]]></description>
        </item>`;
        });

        const rssFeed = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
    <title>סיפור דרך - ישראל</title>
    <link>https://www.sipurderech.co.il/%D7%99%D7%A9%D7%A8%D7%9A%D7%9C</link>
    <description>עדכוני מסלולים אוטומטיים מתוך אתר סיפור דרך</description>
    <language>he</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${rssItems}
</channel>
</rss>`;

        fs.writeFileSync('feed.xml', rssFeed.trim());
        console.log('קובץ feed.xml נוצר בהצלחה.');

    } catch (error) {
        console.error('שגיאה במהלך הפקת ה-RSS:', error.message);
        process.exit(1);
    }
}

generateRss();
