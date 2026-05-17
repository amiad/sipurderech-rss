const fs = require('fs');

async function generateRss() {
    try {
        // 1. משיכת ה-HTML הגולמי מהאתר
        const response = await fetch('https://www.sipurderech.co.il/%D7%99%D7%A9%D7%A8%D7%9A%D7%9C');
        const html = await response.text();

        // 2. חילוץ תגית ה-JSON של ה-Schema באמצעות ביטוי רגולרי (Regex)
        const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g;
        let match;
        let articlesData = null;

        while ((match = regex.exec(html)) !== null) {
            try {
                const json = JSON.parse(match[1].trim());
                if (Array.isArray(json)) {
                    const itemList = json.find(obj => obj['@type'] === 'ItemList');
                    if (itemList && itemList.itemListElement) {
                        articlesData = itemList.itemListElement;
                        break;
                    }
                }
            } catch (e) {
                // התעלמות מסקריפטים אחרים שלא עוברים פארסינג חלק
            }
        }

        if (!articlesData || articlesData.length === 0) {
            throw new Error("לא נמצאו נתוני מסלולים בקוד המקור של הדף");
        }

        // 3. בניית ה-XML של ה-RSS בתצורה סטנדרטית
        let rssItems = '';
        articlesData.forEach(item => {
            // האתר לא מספק תאריך ב-JSON, נשתמש בתאריך הנוכחי בריצה
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

        // 4. שמירת הפיד לקובץxml
        fs.writeFileSync('feed.xml', rssFeed.trim());
        console.log('קובץ feed.xml נוצר בהצלחה עם ' + articlesData.length + ' פריטים.');

    } catch (error) {
        console.error('שגיאה במהלך הפקת ה-RSS:', error.message);
        process.exit(1);
    }
}

generateRss();
