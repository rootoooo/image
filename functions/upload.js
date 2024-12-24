export async function onRequestPost(context) {
    const { request, env } = context;
    const url = new URL(request.url);

    try {
        // 确保请求是 multipart/form-data 格式
        const contentType = request.headers.get('content-type') || '';
        if (!contentType.includes('multipart/form-data')) {
            return new Response('Invalid content-type. Expected multipart/form-data.', { status: 400 });
        }

        // 解析请求体中的文件
        const formData = await request.formData();
        const file = formData.get('file'); // 确保字段名称为 'file'

        if (!file) {
            return new Response('No files passed in the request.', { status: 400 });
        }

        // 文件检查
        if (file.size === 0) {
            return new Response('Uploaded file is empty.', { status: 400 });
        }

        // 打印文件信息（调试用）
        console.log('Uploaded file:', file.name, file.type, file.size);

        // 拼接目标 URL
        const targetUrl = 'https://telegra.ph/' + url.pathname + url.search;
        console.log('Fetching URL:', targetUrl);

        // 将文件上传到目标服务器
        const res_img = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': file.type, // 使用文件的实际 Content-Type
            },
            body: file.stream(), // 直接传递文件流
        });

        // 检查响应状态
        if (!res_img.ok) {
            console.error('Image fetch failed with status:', res_img.status);
            return new Response(`Image fetch failed with status ${res_img.status}`, { status: res_img.status });
        }

        // 解析返回的数据
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
