/**
 * GET /file/{filename}
 */

async function handleRequest(context) {
    const { request, env, params } = context;
    const apikey = env.ModerateContentApiKey
    const ModerateContentUrl = apikey ? `https://api.moderatecontent.com/moderate/?key=${apikey}&` : ""
    const ratingApi = env.RATINGAPI ? `${env.RATINGAPI}?` : ModerateContentUrl;
    const clientIP = request.headers.get("x-forwarded-for") || request.headers.get("clientIP")
    const Referer = request.headers.get('Referer') || "Referer"
    const url = new URL(request.url);

    const res_img = await fetch('https://telegra.ph/' + url.pathname + url.search, {
        method: request.method,
        headers: request.headers,
        body: request.body,
    });


    const options = {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    };
    const timedata = new Date()
    const formatter = new Intl.DateTimeFormat('zh-CN', options);
    const formattedDate = formatter.format(timedata);


    try {
        if (Referer == url.origin + "/admin" || Referer == url.origin + "/list") {
            return res_img;
        } else if (!env.IMG) {
            return res_img;
        } else {
            await insertTgImgLog(env.IMG, url.pathname, Referer, clientIP, formattedDate);
            const rating = await getRating(env.IMG, url.pathname);

            if (rating) {
                if (rating.rating == 3) {
                    return Response.redirect("https://img.131213.xyz/asset/image/blocked.png", 302);
                } else {
                    return res_img;
                }
            } else {
                if (ratingApi) {
                    const rating = await getModerateContentRating(ratingApi, url.pathname);
                    await insertImgInfo(env.IMG, url.pathname, Referer, clientIP, rating.rating, 1, formattedDate);
                    if (rating.rating == 3) {
                        return Response.redirect("https://img.131213.xyz/asset/image/blocked.png", 302);
                    } else {
                        return res_img;
                    }

                } else {
                    await insertImgInfo(env.IMG, url.pathname, Referer, clientIP, 0, 1, formattedDate);
                    return res_img;
                }
            }
        }
    } catch (error) {
        await insertTgImgLog(env.IMG, url.pathname, Referer, clientIP, formattedDate);
        console.log(error);
        return res_img;

    }


}






export async function onRequestGet(context) {
    try {
        // console.log("dddd");
        return await handleRequest(context);
    } catch (error) {
        // 处理异常
        console.error(error);
        return new Response("Internal Server Error", { status: 500 });
    }
}




