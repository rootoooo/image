async function handleRequest(context) {
    const { request, env, params } = context;
    const apikey = env.ModerateContentApiKey;
    const ModerateContentUrl = apikey ? `https://api.moderatecontent.com/moderate/?key=${apikey}&` : null;
    const ratingApi = env.RATINGAPI ? `${env.RATINGAPI}?` : ModerateContentUrl;

    if (!ratingApi) {
        return new Response("Missing rating API configuration", { status: 500 });
    }

    const clientIP = request.headers.get("x-forwarded-for") || request.headers.get("clientIP");
    const Referer = request.headers.get('Referer') || "Referer";
    const url = new URL(request.url);

    const fetchImage = async (url) => {
        try {
            const res = await fetch(url, {
                method: 'GET',
                headers: request.headers,
                body: request.body,
            });
            if (!res.ok) {
                throw new Error(`Failed to fetch image, status: ${res.status}`);
            }
            return res;
        } catch (error) {
            console.error("Error fetching image:", error);
            return new Response("Failed to fetch image", { status: 500 });
        }
    };

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

    const formatter = new Intl.DateTimeFormat('zh-CN', options);

    const getFormattedDate = () => formatter.format(new Date());
    const formattedDate = getFormattedDate();

    const isBlocked = (rating) => rating === 3;
    const handleRating = (rating) => isBlocked(rating) ? Response.redirect(BLOCKED_IMAGE_URL, 302) : null;

    try {
        const res_img = await fetchImage('https://telegra.ph/' + url.pathname + url.search);

        if (Referer == url.origin + "/admin" || Referer == url.origin + "/list") {
            return res_img;
        } else if (!env.IMG) {
            return res_img;
        } else {
            await insertTgImgLog(env.IMG, url.pathname, Referer, clientIP, formattedDate);
            const rating = await getRating(env.IMG, url.pathname);

            if (rating) {
                const redirectResponse = handleRating(rating.rating);
                if (redirectResponse) return redirectResponse;
            } else if (ratingApi) {
                const rating = await getModerateContentRating(ratingApi, url.pathname);
                await Promise.all([
                    insertTgImgLog(env.IMG, url.pathname, Referer, clientIP, formattedDate),
                    insertImgInfo(env.IMG, url.pathname, Referer, clientIP, rating.rating, 1, formattedDate),
                ]);
                const redirectResponse = handleRating(rating.rating);
                if (redirectResponse) return redirectResponse;
            } else {
                await insertImgInfo(env.IMG, url.pathname, Referer, clientIP, 0, 1, formattedDate);
                return res_img;
            }
        }
    } catch (error) {
        console.error("Error handling request:", {
            message: error.message,
            stack: error.stack,
            url: request.url,
            referer: Referer,
            clientIP,
        });
        await insertTgImgLog(env.IMG, url.pathname, Referer, clientIP, formattedDate);
        return new Response("Internal Server Error", { status: 500 });
    }
}

export async function onRequestGet(context) {
    try {
        return await handleRequest(context);
    } catch (error) {
        console.error(error);
        return new Response("Internal Server Error", { status: 500 });
    }
}
