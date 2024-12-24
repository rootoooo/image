export async function onRequestPost(context) {
    const { request, env } = context;
    const url = new URL(request.url);

    try {
        // 拼接目标 URL
        const targetUrl = 'https://telegra.ph/' + url.pathname + url.search;
        console.log('Fetching URL:', targetUrl);

        // 发起请求
        const res_img = await fetch(targetUrl, {
            method: 'GET', // 明确使用 GET 请求
            headers: {
                'Accept': 'application/json', // 根据 API 要求设置头部
            },
        });

        // 检查响应状态
        if (!res_img.ok) {
            console.error('Image fetch failed with status:', res_img.status);
            return new Response(`Image fetch failed with status ${res_img.status}`, { status: res_img.status });
        }

        // 检查返回的 Content-Type
        const contentType = res_img.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            console.error('Invalid response content-type:', contentType);
            return new Response("Invalid response format", { status: 400 });
        }

        // 解析返回的 JSON 数据
        const responseData = await res_img.json();

        // 如果没有 IMG 环境变量，直接返回数据
        if (!env.IMG) {
            return Response.json(responseData);
        }

        // 时间格式化
        const formattedDate = new Date().toISOString();

        try {
            // 调用评级 API 并插入数据库
            const ratingApi = env.RATINGAPI || "https://default-rating-api.com?";
            const rating = await getRating(ratingApi, responseData[0]?.src || '');
            await insertImageData(env.IMG, responseData[0]?.src || '', request.headers.get('Referer') || "Referer", request.headers.get("x-forwarded-for"), rating.rating || 0, formattedDate);
        } catch (error) {
            console.error('Error during rating or database insert:', error);
        }

        return Response.json(responseData);
    } catch (error) {
        console.error("Unhandled error in onRequestPost:", error);
        return new Response("Internal Server Error", { status: 500 });
    }
}

// 获取评级
async function getRating(ratingApi, src) {
    const res = await fetch(`${ratingApi}url=https://telegra.ph${src}`);
    if (res.ok) {
        return await res.json();
    }
    return { rating: 0 }; // 默认评级
}

// 插入图片数据
async function insertImageData(env, src, referer, ip, rating, time) {
    const instdata = await env.prepare(
        `INSERT INTO imginfo (url, referer, ip, rating, total, time)
         VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(src, referer, ip, rating, 1, time).run();
    return instdata;
}
