// Usuario propietario de los hilos de comentarios
const BLUESKY_THREAD_HANDLE = 'fotos.aldeapucela.org'; // Cambia aquí el handle si quieres otro usuario

// Devuelve texto como "24m", "1h", "3d"...
function timeAgo(date) {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now - then) / 1000);
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min.`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} ${months === 1 ? 'mes' : 'meses'}`;
  const years = Math.floor(days / 365);
  return `${years} ${years === 1 ? 'año' : 'años'}`;
}


window.getBlueskyThreadStats = async function(photoUrl) {
  // Use DatabaseManager para evitar descargas múltiples
  let imagePath = null;
  let canonicalUrl = photoUrl || window.location.href;
  if (canonicalUrl.startsWith('http')) {
    const hash = canonicalUrl.split('#')[1];
    if (hash) {
      imagePath = hash; // Solo el ID, sin asumir extensión
    } else {
      imagePath = canonicalUrl.split('/').pop();
    }
  } else {
    imagePath = canonicalUrl;
  }
  
  try {
    // Verificar que DatabaseManager esté disponible
    if (!window.databaseManager) {
      throw new Error('DatabaseManager no está cargado');
    }
    
    // Primero intentar obtener desde la caché
    const cachedStats = await window.databaseManager.getBlueskyStatsFromCache(imagePath);
    
    if (cachedStats && window.databaseManager.isCacheRecent(cachedStats.last_updated)) {
      // Usar datos de la caché si son recientes (menos de 12 horas)
      const threadUrl = `https://bsky.app/profile/${BLUESKY_THREAD_HANDLE}/post/${cachedStats.post_id}`;
      console.log(`💾 Usando stats de caché para ${imagePath}: ${cachedStats.like_count} likes`);
      return { 
        likeCount: cachedStats.like_count, 
        commentCount: cachedStats.comment_count,
        repostCount: cachedStats.repost_count,
        threadUrl,
        fromCache: true 
      };
    }
    
    // Si no hay caché o es antigua, usar la API (fallback al comportamiento original)
    const postId = cachedStats ? cachedStats.post_id : await window.databaseManager.getBlueskyPostId(imagePath);
    
    if (!postId) {
      return { likeCount: 0, commentCount: 0, threadUrl: null };
    }
    
    const threadUrl = `https://bsky.app/profile/${BLUESKY_THREAD_HANDLE}/post/${postId}`;
    const threadApiUrl = `https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=at://${BLUESKY_THREAD_HANDLE}/app.bsky.feed.post/${postId}`;
    console.log(`🌐 Consultando API de Bluesky para ${imagePath} (caché ${cachedStats ? 'antigua' : 'no encontrada'})`);
    
    const threadResponse = await fetch(threadApiUrl, { headers: { Accept: "application/json" } });
    let likeCount = 0;
    let commentCount = 0;
    let repostCount = 0;
    
    if (threadResponse.ok) {
      const threadData = await threadResponse.json();
      likeCount = threadData.thread?.post?.likeCount || 0;
      commentCount = (threadData.thread?.replies || []).length;
      repostCount = threadData.thread?.post?.repostCount || 0;
    }
    
    return { 
      likeCount, 
      commentCount,
      repostCount,
      threadUrl,
      fromCache: false 
    };
  } catch (error) {
    console.error('Error en getBlueskyThreadStats:', error);
    return { likeCount: 0, commentCount: 0, threadUrl: null };
  }
}

// Función para cargar los comentarios de Bluesky
async function loadBlueskyComments(photoUrl, returnCountOnly = false) {
  // photoUrl es la URL canónica de la foto (con hash) o la ruta de la imagen
  let imagePath = null;
  let canonicalUrl = photoUrl || window.location.href;
  // Extraer el nombre del archivo del hash o ruta de la URL
  if (canonicalUrl.startsWith('http')) {
    const hash = canonicalUrl.split('#')[1];
    if (hash) {
      imagePath = hash; // Solo el ID, sin asumir extensión
    } else {
      // fallback: try to extract last path segment
      imagePath = canonicalUrl.split('/').pop();
    }
  } else {
    imagePath = canonicalUrl;
  }
  const commentsDiv = document.getElementById("bluesky-comments");
  try {
    // Verificar que DatabaseManager esté disponible
    if (!window.databaseManager) {
      throw new Error('DatabaseManager no está cargado');
    }
    
    // Si solo necesitamos contadores, intentar usar la caché primero
    if (returnCountOnly) {
      const cachedStats = await window.databaseManager.getBlueskyStatsFromCache(imagePath);
      
      if (cachedStats && window.databaseManager.isCacheRecent(cachedStats.last_updated)) {
        const threadUrl = `https://bsky.app/profile/${BLUESKY_THREAD_HANDLE}/post/${cachedStats.post_id}`;
        console.log(`💾 Usando contadores de caché para ${imagePath}`);
        return { 
          commentCount: cachedStats.comment_count, 
          likeCount: cachedStats.like_count,
          repostCount: cachedStats.repost_count, 
          threadUrl 
        };
      }
    }
    
    // Usar el DatabaseManager para obtener el post_id (reutiliza la BD ya cargada)
    const postId = await window.databaseManager.getBlueskyPostId(imagePath);
    
    if (!postId) {
      // No post_id found, show default message
      if (commentsDiv) {
        commentsDiv.innerHTML = `<div class='flex flex-col items-center text-instagram-500 py-6'>
          <i class='fa-regular fa-comment-dots text-3xl mb-2'></i>
          <span class='text-base'>No hay hilo de comentarios para esta foto aún</span>
        </div>`;
      }
      if (returnCountOnly) return { commentCount: 0, likeCount: 0, threadUrl: null };
      return;
    }
    // Now fetch the thread/comments from Bluesky API using postId
    const threadUrl = `https://bsky.app/profile/${BLUESKY_THREAD_HANDLE}/post/${postId}`;
    const threadApiUrl = `https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=at://${BLUESKY_THREAD_HANDLE}/app.bsky.feed.post/${postId}`;
    const threadResponse = await fetch(threadApiUrl, { headers: { Accept: "application/json" } });
    let allComments = [];
    let likeCount = 0;
    if (threadResponse.ok) {
      const threadData = await threadResponse.json();
      if (threadData.thread) {
        likeCount = threadData.thread.post?.likeCount || 0;
        allComments = threadData.thread.replies || [];
      }
    }
    if (returnCountOnly) {
      return { commentCount: allComments.length, likeCount, threadUrl };
    }
    // Render comments as before
    if (commentsDiv) commentsDiv.innerHTML = '';
    if (allComments.length === 0) {
      commentsDiv.innerHTML = `<div class="flex flex-col items-center text-instagram-500 py-6">
        <i class='fa-regular fa-comment-dots text-3xl mb-2'></i>
        <span class='text-base'>Sé el primero en comentar</span>
      </div>`;
      // Add button to comment
      const addBtn = document.createElement('button');
      addBtn.className = 'mt-4 flex items-center gap-2 text-instagram-500 hover:text-instagram-700 font-medium';
      addBtn.innerHTML = `<i class='fa-regular fa-comment-dots'></i> Añadir comentario`;
      addBtn.onclick = () => window.open(threadUrl, '_blank');
      commentsDiv.appendChild(addBtn);
      return;
    }
    // Add button to comment (top)
    const addBtnTop = document.createElement('button');
    addBtnTop.className = 'mb-4 flex items-center gap-2 text-instagram-500 hover:text-instagram-700 font-medium';
    addBtnTop.innerHTML = `<i class='fa-regular fa-comment-dots'></i> Añadir comentario`;
    addBtnTop.onclick = () => window.open(threadUrl, '_blank');
    commentsDiv.appendChild(addBtnTop);
    const commentsList = document.createElement("ul");
    const sortedComments = allComments.sort((a, b) => new Date(a.post.indexedAt) - new Date(b.post.indexedAt));
    sortedComments.forEach((reply) => {
      if (!reply?.post?.record?.text) return;
      const author = reply.post.author;
      const li = document.createElement("li");
      li.className = "mb-4 p-3 bg-white dark:bg-instagram-800 rounded shadow-sm";
      // Escapar todos los datos del usuario para prevenir XSS
      const safeAvatar = encodeURI(author.avatar || '');
      const safeDid = encodeURIComponent(author.did);
      const safeDisplayName = document.createElement('span');
      safeDisplayName.textContent = author.displayName || author.handle;
      const safeText = document.createElement('p');
      safeText.className = "text-instagram-500 text-sm mb-2";
      safeText.textContent = reply.post.record.text;
      const safePostId = encodeURIComponent(reply.post.uri.split("/").pop());
      
      li.innerHTML = `
        <div class="flex items-center gap-3 mb-2">
          <img src="${safeAvatar}" alt="avatar" class="w-7 h-7 rounded-full border border-instagram-200 dark:border-instagram-700 bg-white object-cover" loading="lazy" />
          <div>
            <a href="https://bsky.app/profile/${safeDid}" target="_blank" class="font-bold text-instagram-600 hover:text-instagram-700 text-sm">${safeDisplayName.innerHTML}</a>
            <span class="ml-2 text-xs text-instagram-400">${timeAgo(reply.post.record.createdAt)}</span>
          </div>
        </div>
        ${safeText.outerHTML}
        <div class="flex gap-2 text-xs text-instagram-400">
          <span><i class="fa-regular fa-comment"></i> ${parseInt(reply.post.replyCount) || 0}</span>
          <span><i class="fa-solid fa-retweet"></i> ${parseInt(reply.post.repostCount) || 0}</span>
          <span><i class="fa-regular fa-heart"></i> ${parseInt(reply.post.likeCount) || 0}</span>
          <a href="https://bsky.app/profile/${safeDid}/post/${safePostId}" target="_blank" class="ml-auto text-instagram-500 hover:text-instagram-700"><i class="fa-solid fa-arrow-up-right-from-square"></i></a>
        </div>
      `;
      commentsList.appendChild(li);
    });
    commentsDiv.appendChild(commentsList);
    // Add button to comment (bottom)
    const addBtn = document.createElement('button');
    addBtn.className = 'mt-6 flex items-center gap-2 text-instagram-500 hover:text-instagram-700 font-medium';
    addBtn.innerHTML = `<i class='fa-regular fa-comment-dots'></i> Añadir comentario`;
    addBtn.onclick = () => window.open(threadUrl, '_blank');
    commentsDiv.appendChild(addBtn);
  } catch (error) {
    if (commentsDiv) commentsDiv.innerHTML = `<div class='text-instagram-500 py-6'>Error cargando comentarios Bluesky</div>`;
    if (returnCountOnly) return { commentCount: 0, likeCount: 0, threadUrl: null };
  }
}
