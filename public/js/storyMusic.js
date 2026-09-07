// =============================================================================
// MetaPulse - Story Music & FFmpeg Video Generation Controller
// =============================================================================

const StoryMusicState = {
  enabled: false,
  activeSource: 'curated',
  selectedTrack: null, // { id, title, artist, streamUrl, durationSec }
  startTime: 0,
  duration: 15,
  addSticker: true,
  generatedVideoUrl: null,
  catalog: [],
  audioPlayer: new Audio(),
  playingTrackId: null
};

// Exponer al scope global para sincronización con Composer
window.StoryMusicState = StoryMusicState;

document.addEventListener('DOMContentLoaded', () => {
  // Elementos DOM
  const section = document.getElementById('story-music-section');
  const chkEnable = document.getElementById('chk-story-music-enabled');
  const drawer = document.getElementById('story-music-drawer');
  const tracklistContainer = document.getElementById('music-track-list');
  const searchInput = document.getElementById('music-search-input');
  const categoryPillsContainer = document.getElementById('music-category-pills');
  const audioFileInput = document.getElementById('story-audio-file-input');
  const audioDropzone = document.getElementById('story-audio-dropzone');
  
  // Panel de Pista Activa
  const activePanel = document.getElementById('story-active-music-panel');
  const activeTrackTitle = document.getElementById('active-music-title');
  const activeTrackArtist = document.getElementById('active-music-artist');
  const btnActivePlay = document.getElementById('btn-active-music-play');
  const trimSlider = document.getElementById('music-trim-slider');
  const trimDisplay = document.getElementById('music-trim-display');
  const chkMusicSticker = document.getElementById('chk-music-sticker');
  const btnGenerateVideo = document.getElementById('btn-generate-story-video');
  const videoSuccessBox = document.getElementById('story-video-success-box');
  const videoDownloadLink = document.getElementById('story-video-download-link');

  // Preview elements del Mockup
  const mockSticker = document.getElementById('mock-story-music-sticker');
  const mockTitle = document.getElementById('mock-music-title');
  const mockArtist = document.getElementById('mock-music-artist');

  if (!section || !chkEnable) return;

  // 1. Toggle Activación de Música
  chkEnable.addEventListener('change', () => {
    StoryMusicState.enabled = chkEnable.checked;
    drawer.style.display = chkEnable.checked ? 'flex' : 'none';

    if (chkEnable.checked && StoryMusicState.catalog.length === 0) {
      loadCatalog();
    }
    updateMockupMusicOverlay();
  });

  // 2. Tabs de Fuentes (Curada vs Subir Archivo vs Búsqueda)
  document.querySelectorAll('.music-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.music-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const target = btn.dataset.tab;
      StoryMusicState.activeSource = target;

      document.getElementById('music-tab-curated').style.display = target === 'curated' ? 'block' : 'none';
      document.getElementById('music-tab-upload').style.display = target === 'upload' ? 'block' : 'none';
      document.getElementById('music-tab-jamendo').style.display = target === 'jamendo' ? 'block' : 'none';
    });
  });

  // 3. Cargar Catálogo Curado de Música Sin Copyright
  async function loadCatalog(category = 'all', query = '') {
    try {
      tracklistContainer.innerHTML = '<div style="text-align:center; padding:20px; color:#94a3b8; font-size:0.8rem;">Cargando catálogo sin copyright...</div>';
      
      const params = new URLSearchParams();
      if (category && category !== 'all') params.append('category', category);
      if (query && query.trim()) params.append('q', query.trim());

      const res = await fetch(`/api/music/library?${params.toString()}`);
      const json = await res.json();

      if (json.success && json.data) {
        StoryMusicState.catalog = json.data.tracks || [];
        renderCategoryPills(json.data.categories || []);
        renderTrackList(StoryMusicState.catalog);

        // Si no hay pista seleccionada aún, preseleccionar la primera
        if (!StoryMusicState.selectedTrack && StoryMusicState.catalog.length > 0) {
          selectTrack(StoryMusicState.catalog[0], false);
        }
      }
    } catch (err) {
      tracklistContainer.innerHTML = `<div style="color:#f43f5e; padding:15px; font-size:0.8rem;">Error al cargar pistas: ${err.message}</div>`;
    }
  }

  function renderCategoryPills(categories) {
    if (!categoryPillsContainer) return;
    categoryPillsContainer.innerHTML = '';
    categories.forEach(cat => {
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = `music-cat-pill ${cat.id === 'all' ? 'active' : ''}`;
      pill.textContent = cat.label;
      pill.addEventListener('click', () => {
        categoryPillsContainer.querySelectorAll('.music-cat-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        loadCatalog(cat.id, searchInput?.value || '');
      });
      categoryPillsContainer.appendChild(pill);
    });
  }

  function renderTrackList(tracks) {
    if (!tracklistContainer) return;
    if (tracks.length === 0) {
      tracklistContainer.innerHTML = '<div style="text-align:center; padding:25px; color:#94a3b8; font-size:0.8rem;">No se encontraron pistas con ese criterio.</div>';
      return;
    }

    tracklistContainer.innerHTML = '';
    tracks.forEach(track => {
      const isSelected = StoryMusicState.selectedTrack && StoryMusicState.selectedTrack.id === track.id;
      const isPlaying = StoryMusicState.playingTrackId === track.id;

      const item = document.createElement('div');
      item.className = `music-track-item ${isSelected ? 'selected' : ''}`;
      item.innerHTML = `
        <div class="track-left">
          <button type="button" class="track-play-btn ${isPlaying ? 'playing' : ''}" data-id="${track.id}" title="Escuchar fragmento">
            ${isPlaying ? '⏸' : '▶'}
          </button>
          <div class="track-info">
            <span class="track-title">${track.title}</span>
            <span class="track-artist-meta">
              <span>👤 ${track.artist}</span>
              <span>•</span>
              <span>⏱ ${formatDuration(track.durationSec)}</span>
              <span>•</span>
              <span style="color:#ec4899; font-weight:600;">${track.mood || ''}</span>
            </span>
          </div>
        </div>
        <div class="track-right">
          <span class="track-badge">${track.badge || 'CC-BY'}</span>
          <button type="button" class="btn-select-track" data-id="${track.id}">
            ${isSelected ? '✓ Seleccionada' : 'Seleccionar'}
          </button>
        </div>
      `;

      // Botón Play
      const playBtn = item.querySelector('.track-play-btn');
      playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePlayTrack(track);
      });

      // Botón Seleccionar
      const selectBtn = item.querySelector('.btn-select-track');
      selectBtn.addEventListener('click', () => {
        selectTrack(track, true);
      });

      item.addEventListener('click', (e) => {
        if (!e.target.closest('.track-play-btn')) {
          selectTrack(track, true);
        }
      });

      tracklistContainer.appendChild(item);
    });
  }

  // 4. Selección y Configuración de Pista
  function selectTrack(track, playSnippet = false) {
    StoryMusicState.selectedTrack = track;
    activePanel.style.display = 'flex';

    if (activeTrackTitle) activeTrackTitle.textContent = track.title;
    if (activeTrackArtist) activeTrackArtist.textContent = track.artist;

    // Actualizar slider de recorte
    const maxSec = Math.max((track.durationSec || 120) - StoryMusicState.duration, 10);
    trimSlider.max = Math.min(maxSec, 180);
    trimSlider.value = StoryMusicState.startTime || 0;
    updateTrimDisplay();

    // Actualizar selección visual en la lista
    document.querySelectorAll('.music-track-item').forEach(el => {
      const isThis = el.querySelector(`.btn-select-track[data-id="${track.id}"]`);
      el.classList.toggle('selected', Boolean(isThis));
      const btn = el.querySelector('.btn-select-track');
      if (btn) btn.textContent = isThis ? '✓ Seleccionada' : 'Seleccionar';
    });

    updateMockupMusicOverlay();

    if (playSnippet) {
      playTrackSnippet(track.streamUrl, StoryMusicState.startTime, track.id);
    }
  }

  // 5. Control de Reproducción de Audio en el Navegador
  function togglePlayTrack(track) {
    if (StoryMusicState.playingTrackId === track.id) {
      stopAudio();
    } else {
      playTrackSnippet(track.streamUrl, StoryMusicState.startTime || 0, track.id);
    }
  }

  function playTrackSnippet(url, startTimeSec = 0, trackId = null) {
    StoryMusicState.audioPlayer.pause();
    StoryMusicState.audioPlayer.src = url;
    StoryMusicState.audioPlayer.currentTime = startTimeSec;
    StoryMusicState.playingTrackId = trackId;

    StoryMusicState.audioPlayer.play().then(() => {
      updatePlayButtonsState();
    }).catch(err => {
      console.warn('Audio play error:', err);
    });
  }

  function stopAudio() {
    StoryMusicState.audioPlayer.pause();
    StoryMusicState.playingTrackId = null;
    updatePlayButtonsState();
  }

  function updatePlayButtonsState() {
    document.querySelectorAll('.track-play-btn').forEach(btn => {
      const isThisPlaying = btn.dataset.id === StoryMusicState.playingTrackId;
      btn.classList.toggle('playing', isThisPlaying);
      btn.textContent = isThisPlaying ? '⏸' : '▶';
    });
    if (btnActivePlay) {
      btnActivePlay.textContent = StoryMusicState.playingTrackId ? '⏸ Pausar' : '▶ Escuchar';
    }
  }

  StoryMusicState.audioPlayer.addEventListener('ended', stopAudio);

  if (btnActivePlay) {
    btnActivePlay.addEventListener('click', () => {
      if (StoryMusicState.selectedTrack) {
        togglePlayTrack(StoryMusicState.selectedTrack);
      }
    });
  }

  // 6. Slider de Tiempo de Inicio y Recorte
  trimSlider.addEventListener('input', () => {
    StoryMusicState.startTime = Number(trimSlider.value) || 0;
    updateTrimDisplay();
    if (StoryMusicState.playingTrackId && StoryMusicState.selectedTrack) {
      StoryMusicState.audioPlayer.currentTime = StoryMusicState.startTime;
    }
  });

  function updateTrimDisplay() {
    const sec = StoryMusicState.startTime || 0;
    const endSec = sec + StoryMusicState.duration;
    trimDisplay.textContent = `${formatDuration(sec)} a ${formatDuration(endSec)} (${StoryMusicState.duration}s)`;
  }

  // 7. Duración de la Historia (10s, 15s, 30s)
  document.querySelectorAll('.duration-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.duration-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      StoryMusicState.duration = Number(pill.dataset.duration) || 15;
      updateTrimDisplay();
    });
  });

  // 8. Sticker de Música Toggle
  chkMusicSticker.addEventListener('change', () => {
    StoryMusicState.addSticker = chkMusicSticker.checked;
    updateMockupMusicOverlay();
  });

  // 9. Subida de Archivo de Audio Personalizado
  if (audioDropzone && audioFileInput) {
    audioDropzone.addEventListener('click', () => audioFileInput.click());

    audioFileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      await uploadCustomAudio(file);
    });

    audioDropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      audioDropzone.style.borderColor = '#ec4899';
    });
    audioDropzone.addEventListener('dragleave', () => {
      audioDropzone.style.borderColor = 'rgba(236, 72, 153, 0.4)';
    });
    audioDropzone.addEventListener('drop', async (e) => {
      e.preventDefault();
      audioDropzone.style.borderColor = 'rgba(236, 72, 153, 0.4)';
      const file = e.dataTransfer.files[0];
      if (file) await uploadCustomAudio(file);
    });
  }

  async function uploadCustomAudio(file) {
    const formData = new FormData();
    formData.append('audio', file);

    const dropText = audioDropzone.querySelector('p');
    const origText = dropText.textContent;
    dropText.textContent = '⏳ Subiendo y procesando audio...';

    try {
      const res = await fetch('/api/music/upload', {
        method: 'POST',
        body: formData
      });
      const json = await res.json();

      if (json.success && json.data) {
        if (typeof showToast === 'function') showToast('¡Canción subida con éxito!', 'success');
        
        const customTrack = {
          id: `custom_${Date.now()}`,
          title: file.name.replace(/\.[^/.]+$/, ''),
          artist: 'Mi Audio Propio',
          durationSec: 180,
          streamUrl: json.data.relativeUrl,
          badge: 'Propio'
        };

        selectTrack(customTrack, true);
        dropText.textContent = `✅ ${file.name}`;
      } else {
        if (typeof showToast === 'function') showToast('Error al subir audio: ' + (json.error || 'Desconocido'), 'error');
        dropText.textContent = origText;
      }
    } catch (err) {
      if (typeof showToast === 'function') showToast('Error de conexión: ' + err.message, 'error');
      dropText.textContent = origText;
    }
  }

  // 10. Búsqueda en Jamendo API
  const btnJamendoSearch = document.getElementById('btn-jamendo-search');
  const jamendoInput = document.getElementById('jamendo-search-input');
  const jamendoResults = document.getElementById('jamendo-results-list');

  if (btnJamendoSearch && jamendoInput) {
    btnJamendoSearch.addEventListener('click', searchJamendoTracks);
    jamendoInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') searchJamendoTracks();
    });
  }

  async function searchJamendoTracks() {
    const query = jamendoInput?.value?.trim();
    if (!query) return;

    jamendoResults.innerHTML = '<div style="text-align:center; padding:15px; color:#94a3b8; font-size:0.8rem;">Buscando en Jamendo...</div>';

    try {
      const res = await fetch(`/api/music/search?q=${encodeURIComponent(query)}&limit=15`);
      const json = await res.json();

      if (json.success && json.data?.results) {
        const results = json.data.results;
        if (results.length === 0) {
          jamendoResults.innerHTML = '<div style="text-align:center; padding:15px; color:#94a3b8; font-size:0.8rem;">No se encontraron resultados en Jamendo.</div>';
          return;
        }

        jamendoResults.innerHTML = '';
        results.forEach(track => {
          const item = document.createElement('div');
          item.className = 'music-track-item';
          item.innerHTML = `
            <div class="track-left">
              <button type="button" class="track-play-btn" data-id="${track.id}">▶</button>
              <div class="track-info">
                <span class="track-title">${track.title}</span>
                <span class="track-artist-meta">👤 ${track.artist} • ⏱ ${formatDuration(track.durationSec)}</span>
              </div>
            </div>
            <div class="track-right">
              <span class="track-badge">Jamendo</span>
              <button type="button" class="btn-select-track" data-id="${track.id}">Seleccionar</button>
            </div>
          `;

          item.querySelector('.track-play-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            togglePlayTrack(track);
          });
          item.querySelector('.btn-select-track').addEventListener('click', () => {
            selectTrack(track, true);
          });

          jamendoResults.appendChild(item);
        });
      }
    } catch (err) {
      jamendoResults.innerHTML = `<div style="color:#f43f5e; padding:10px; font-size:0.8rem;">Error: ${err.message}</div>`;
    }
  }

  // 11. Generar Video Story MP4 con FFmpeg
  btnGenerateVideo.addEventListener('click', async () => {
    if (!StoryMusicState.selectedTrack) {
      if (typeof showToast === 'function') showToast('Por favor selecciona primero una canción o audio.', 'warning');
      return;
    }

    if (!ComposerState.mediaFiles || ComposerState.mediaFiles.length === 0) {
      if (typeof showToast === 'function') showToast('Sube primero una imagen al composer para convertirla en video.', 'warning');
      return;
    }

    const baseImage = ComposerState.mediaFiles[0];
    btnGenerateVideo.disabled = true;
    btnGenerateVideo.innerHTML = '⏳ Codificando video MP4 con FFmpeg...';
    stopAudio();

    if (typeof showToast === 'function') {
      showToast('Generando Video Story vertical 9:16 con FFmpeg... (Tarda ~2-4 segundos)', 'info');
    }

    try {
      const payload = {
        image_url: baseImage,
        audio_url: StoryMusicState.selectedTrack.streamUrl,
        duration: StoryMusicState.duration,
        start_time: StoryMusicState.startTime,
        add_music_sticker: StoryMusicState.addSticker,
        song_title: StoryMusicState.selectedTrack.title,
        song_artist: StoryMusicState.selectedTrack.artist
      };

      const res = await fetch('/api/stories/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();

      if (json.success && json.data) {
        StoryMusicState.generatedVideoUrl = json.data.relativeUrl;
        
        // Si el post actual es una Story, reemplazar o asignar el video al composer
        const postTypeRadio = document.querySelector('input[name="post_type"]:checked');
        if (postTypeRadio && postTypeRadio.value === 'story') {
          ComposerState.mediaFiles[0] = json.data.relativeUrl;
          if (typeof renderMediaPreviews === 'function') renderMediaPreviews();
        }

        // Actualizar mockup de Instagram Story con el video real
        const mockStoryMedia = document.getElementById('mock-story-media');
        if (mockStoryMedia) {
          mockStoryMedia.innerHTML = `
            <video src="${json.data.relativeUrl}" controls autoplay loop style="width:100%; height:100%; object-fit:cover;"></video>
          `;
        }

        // Mostrar caja de éxito
        if (videoSuccessBox) {
          videoSuccessBox.style.display = 'flex';
          const sizeMb = (json.data.sizeBytes / 1024 / 1024).toFixed(2);
          videoSuccessBox.querySelector('.video-status-text').textContent = 
            `¡Video Story MP4 listo! (${json.data.duration}s • ${sizeMb} MB • H.264/AAC)`;
        }
        if (videoDownloadLink) {
          videoDownloadLink.href = json.data.relativeUrl;
          videoDownloadLink.style.display = 'inline-flex';
        }

        if (typeof showToast === 'function') {
          showToast('¡Video Story con música generado con éxito!', 'success');
        }

        // Cambiar pestaña del preview a Story para que el usuario lo vea
        const storyTab = document.querySelector('.preview-tab[data-preview="story"]');
        if (storyTab) storyTab.click();
      } else {
        if (typeof showToast === 'function') {
          showToast('Error al generar video: ' + (json.error || 'Error en FFmpeg'), 'error');
        }
      }
    } catch (err) {
      if (typeof showToast === 'function') {
        showToast('Error al conectar con el servidor: ' + err.message, 'error');
      }
    } finally {
      btnGenerateVideo.disabled = false;
      btnGenerateVideo.innerHTML = '⚡ Generar Video Story con Audio Ahora';
    }
  });

  // 12. Actualizar Sticker en Mockup de Instagram Story
  function updateMockupMusicOverlay() {
    if (!mockSticker) return;

    const shouldShow = StoryMusicState.enabled && StoryMusicState.addSticker && StoryMusicState.selectedTrack;
    mockSticker.style.display = shouldShow ? 'flex' : 'none';

    if (shouldShow && StoryMusicState.selectedTrack) {
      if (mockTitle) mockTitle.textContent = StoryMusicState.selectedTrack.title;
      if (mockArtist) mockArtist.textContent = `${StoryMusicState.selectedTrack.artist} • Instagram Audio`;
    }
  }

  // Utilidad de formato de tiempo (mm:ss)
  function formatDuration(sec) {
    const s = Math.round(Number(sec) || 0);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${rem < 10 ? '0' : ''}${rem}`;
  }

  // Búsqueda en tiempo real con debounce
  if (searchInput) {
    let searchTimeout;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        loadCatalog('all', searchInput.value);
      }, 300);
    });
  }

  // Observador de cambio de formato de post en Composer
  document.querySelectorAll('input[name="post_type"]').forEach(r => {
    r.addEventListener('change', () => {
      if (r.value === 'story') {
        section.style.display = 'block';
      }
    });
  });

  const chkAlsoShare = document.getElementById('chk-also-share-story');
  if (chkAlsoShare) {
    chkAlsoShare.addEventListener('change', () => {
      if (chkAlsoShare.checked) {
        section.style.display = 'block';
      }
    });
  }

  // Reset function
  window.resetStoryMusic = function() {
    stopAudio();
    StoryMusicState.enabled = false;
    StoryMusicState.generatedVideoUrl = null;
    chkEnable.checked = false;
    drawer.style.display = 'none';
    if (videoSuccessBox) videoSuccessBox.style.display = 'none';
    updateMockupMusicOverlay();
  };
});
