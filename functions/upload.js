export async function onRequestPost(context) {
    try {
        const { request, env } = context;
        const url = new URL(request.url);
        const apikey = env.ModerateContentApiKey;
        const ModerateContentUrl = apikey ? `https://api.moderatecontent.com/moderate/?key=${apikey}&` : "";
        const ratingApi = env.RATINGAPI || ModerateContentUrl || "https://default-rating-api.com?";
        const clientIP = request.headers.get("x-forwarded-for") || request.headers.get("clientIP");
        const Referer = request.headers.get('Referer') || "Referer";

        // 调试日志
        console.log('Fetching URL:', 'https://telegra.ph/' + url.pathname + url.search);

        // Fetch 图像
        const res_img = await fetch('https://telegra.ph/' + url.pathname + url.search, {
            method: request.method,
            headers: request.headers,
            body: request.body,
        });

        if (!res_img.ok) {
            console.error('Image fetch failed with status:', res_img.status);
            return new Response(`Image fetch failed with status ${res_img.status}`, { status: res_img.status });
        }

        // 检查返回类型
        const contentType = res_img.headers.get("content-type");
        if (!contentType?.includes("application/json")) {
            console.error('Invalid response content-type:', contentType);
            return new Response("Invalid response format", { status: 400 });
        }

        const responseData = await res_img.json();

        // 时间格式化
        const formattedDate = new Date().toISOString();

        if (!env.IMG) {
            return res_img;
        } else {
            try {
                const rating = await getRating(ratingApi, responseData[0]?.src || '');
                await insertImageData(env.IMG, responseData[0]?.src || '', Referer, clientIP, rating.rating || 0, formattedDate);
            } catch (e) {
                console.error('Error during rating or DB insert:', e);
                await insertImageData(env.IMG, responseData[0]?.src || '', Referer, clientIP, 5, formattedDate);
            }

            return Response.json(responseData);
        }
    } catch (error) {
        console.error("Unhandled error in onRequestPost:", error);
        return new Response("Internal Server Error", { status: 500 });
    }
}

async function getRating(ratingApi, src) {
    try {
        const res = await fetch(`${ratingApi}url=https://telegra.ph${src}`);
        return await res.json();
    } catch (error) {
        console.error("Error fetching rating:", error);
        return { rating: 0 };
    }
}

async function insertImageData(env, src, referer, ip, rating, time) {
    try {
        const instdata = await env.prepare(
            `INSERT INTO imginfo (url, referer, ip, rating, total, time)
             VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(src, referer, ip, rating, 1, time).run();
        return instdata;
    } catch (error) {
        console.error("Error inserting data into database:", error);
    }
}
