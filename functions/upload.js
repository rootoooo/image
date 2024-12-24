export async function onRequestPost(context) {
    try {
        const { request, env } = context;
        const url = new URL(request.url);
        const apikey = env.ModerateContentApiKey;
        const ModerateContentUrl = apikey ? `https://api.moderatecontent.com/moderate/?key=${apikey}&` : "";
        const ratingApi = env.RATINGAPI || ModerateContentUrl || "https://default-rating-api.com?";
        const clientIP = request.headers.get("x-forwarded-for") || request.headers.get("clientIP");
        const Referer = request.headers.get('Referer') || "Referer";

        const res_img = await fetch('https://telegra.ph/' + url.pathname + url.search, {
            method: request.method,
            headers: request.headers,
            body: request.body,
        });

        if (!res_img.ok) {
            return new Response("Image fetch failed", { status: res_img.status });
        }

        const formattedDate = new Date().toISOString();

        if (!env.IMG) {
            return res_img;
        } else {
            if (res_img.headers.get("content-type")?.includes("application/json")) {
                const responseData = await res_img.json();
                try {
                    const rating = await getRating(ratingApi, responseData[0].src);
                    await insertImageData(env.IMG, responseData[0].src, Referer, clientIP, rating.rating, formattedDate);
                } catch (e) {
                    console.error("Error during rating or DB insert:", e);
                    await insertImageData(env.IMG, responseData[0].src, Referer, clientIP, 5, formattedDate);
                }

                return Response.json(responseData);
            } else {
                return new Response("Invalid response format", { status: 400 });
            }
        }
    } catch (error) {
        console.error("Error in onRequestPost:", error);
        return new Response("Internal Server Error", { status: 500 });
    }
}

async function getRating(ratingApi, src) {
    try {
        const res = await fetch(`${ratingApi}url=https://telegra.ph${src}`);
        return await res.json();
    } catch (error) {
        console.error("Error fetching rating:", error);
        return { rating: 0 }; // 默认评分
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
