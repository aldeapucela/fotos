// Usuario propietario de los hilos de comentarios
const BLUESKY_THREAD_HANDLE = 'fotos.aldeapucela.org'; // Cambia aquí el handle si quieres otro usuario

window.getBlueskyThreadStats = async function(photoUrl) {
  const currentUrl = photoUrl || window.location.href;
  const searchParams = new URLSearchParams({
    q: '',
    author: BLUESKY_THREAD_HANDLE,
    url: currentUrl
  });
  const searchResponse = await fetch(
    `https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?${searchParams}`,
    { headers: { Accept: "application/json" } }
  );
  if (!searchResponse.ok) return { likeCount: 0, threadUrl: null };
  const searchData = await searchResponse.json();
  const threadPost = searchData.posts.find(post => post.author && post.author.handle === BLUESKY_THREAD_HANDLE);
  if (threadPost) {
    const threadUrl = `https://bsky.app/profile/${threadPost.author.did}/post/${threadPost.uri.split('/').pop()}`;
    return { likeCount: threadPost.likeCount || 0, threadUrl };
  }
  return { likeCount: 0, threadUrl: null };
}


async function loadBlueskyComments(photoUrl, returnCountOnly = false) {
  const currentUrl = photoUrl || window.location.href;
  const commentsDiv = document.getElementById("bluesky-comments");

  try {
    // Search for posts by author and url (more precise)
    const searchParams = new URLSearchParams({
      q: currentUrl,
      author: BLUESKY_THREAD_HANDLE,
      url: currentUrl
    });
    const searchResponse = await fetch(
      `https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?${searchParams}`,
      { headers: { Accept: "application/json" } }
    );

    if (!searchResponse.ok) {
      throw new Error("Failed to search posts");
    }

    const searchData = await searchResponse.json();

    // Filtra solo posts del usuario concreto y que tengan facet link a la url exacta
    const threadPost = searchData.posts.find(post =>
      post.author &&
      post.author.handle === BLUESKY_THREAD_HANDLE &&
      Array.isArray(post.record.facets) &&
      post.record.facets.some(facet =>
        Array.isArray(facet.features) &&
        facet.features.some(feature =>
          feature.$type === "app.bsky.richtext.facet#link" &&
          feature.uri === currentUrl
        )
      )
    );
    let allComments = [];
    if (threadPost) {
      const threadParams = new URLSearchParams({ uri: threadPost.uri });
      const threadResponse = await fetch(
        `https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?${threadParams}`,
        { headers: { Accept: "application/json" } }
      );
      if (threadResponse.ok) {
        const threadData = await threadResponse.json();
        if (threadData.thread?.replies) {
          allComments = threadData.thread.replies;
        }
      }
    }


    // Enlace al hilo principal (de ese usuario) o a su perfil
    const mainThreadUrl = (threadPost)
      ? `https://bsky.app/profile/${threadPost.author.did}/post/${threadPost.uri.split('/').pop()}`
      : `https://bsky.app/profile/${BLUESKY_THREAD_HANDLE}`;

    if (returnCountOnly) {
      // Devuelve número de comentarios, likes y URL del hilo
      return {
        commentCount: allComments.length,
        likeCount: threadPost ? (threadPost.likeCount || 0) : 0,
        threadUrl: threadPost ? `https://bsky.app/profile/${threadPost.author.did}/post/${threadPost.uri.split('/').pop()}` : null
      };
    }
    // Elimina el mensaje de cargando si existe
    if (commentsDiv) commentsDiv.innerHTML = '';
    if (allComments.length === 0) {
      commentsDiv.innerHTML = `<div class="flex flex-col items-center text-instagram-500 py-6">
        <i class='fa-regular fa-comment-dots text-3xl mb-2'></i>
        <span class='text-base'>Sé el primero en comentar</span>
      </div>`;
      // Añadir botón para comentar
      const addBtn = document.createElement('button');
      addBtn.className = 'mt-4 flex items-center gap-2 text-instagram-500 hover:text-instagram-700 font-medium';
      addBtn.innerHTML = `<i class='fa-regular fa-comment-dots'></i> Añadir comentario`;
      addBtn.onclick = () => window.open(mainThreadUrl, '_blank');
      commentsDiv.appendChild(addBtn);
      return;
    
    }
    // Botón para añadir comentario (arriba)
    const addBtnTop = document.createElement('button');
    addBtnTop.className = 'mb-4 flex items-center gap-2 text-instagram-500 hover:text-instagram-700 font-medium';
    addBtnTop.innerHTML = `<i class='fa-regular fa-comment-dots'></i> Añadir comentario`;
    addBtnTop.onclick = () => window.open(mainThreadUrl, '_blank');
    commentsDiv.appendChild(addBtnTop);

    const commentsList = document.createElement("ul");

    // Sort all comments by time
    const sortedComments = allComments.sort(
      (a, b) => new Date(a.post.indexedAt) - new Date(b.post.indexedAt)
    );

    // Format each of the comments
    sortedComments.forEach((reply) => {
      if (!reply?.post?.record?.text) return;
      const author = reply.post.author;
      const li = document.createElement("li");
      li.className = "mb-4 p-3 bg-white dark:bg-instagram-800 rounded shadow-sm";
      li.innerHTML = `
        <div class="flex items-center gap-3 mb-2">
          <img src="${author.avatar || ''}" alt="avatar" class="w-7 h-7 rounded-full mr-2 border border-instagram-200 dark:border-instagram-700 bg-white object-cover" loading="lazy" />
          <div>
            <a href="https://bsky.app/profile/${author.did}" target="_blank" class="font-bold text-instagram-600 hover:text-instagram-700">${author.displayName || author.handle}</a>
            <span class="ml-2 text-xs text-instagram-400">${new Date(reply.post.record.createdAt).toLocaleString('es-ES', {dateStyle: 'short', timeStyle: 'short'})}</span>
          </div>
        </div>
        <p class="text-instagram-500 text-sm mb-2">${reply.post.record.text}</p>
        <div class="flex gap-2 text-xs text-instagram-400">
          <span><i class="fa-regular fa-comment"></i> ${reply.post.replyCount || 0}</span>
          <span><i class="fa-solid fa-retweet"></i> ${reply.post.repostCount || 0}</span>
          <span><i class="fa-regular fa-heart"></i> ${reply.post.likeCount || 0}</span>
          <a href="https://bsky.app/profile/${author.did}/post/${reply.post.uri.split("/").pop()}" target="_blank" class="ml-auto text-instagram-500 hover:text-instagram-700"><i class="fa-solid fa-arrow-up-right-from-square"></i></a>
        </div>
      `;
      commentsList.appendChild(li);
    });

    commentsDiv.appendChild(commentsList);
    // Añadir botón para comentar al final
    const addBtn = document.createElement('button');
    addBtn.className = 'mt-6 flex items-center gap-2 text-instagram-500 hover:text-instagram-700 font-medium';
    addBtn.innerHTML = `<i class='fa-regular fa-comment-dots'></i> Añadir comentario`;
    addBtn.onclick = () => window.open(mainThreadUrl, '_blank');
    commentsDiv.appendChild(addBtn);
  } catch (error) {
    throw new Error(error);
  }
}
