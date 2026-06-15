// ============================================
// VARIABLES GLOBALES
// ============================================
let currentPhraseIndex = 0;
let phrasesData = [];
let sliderData = [];
let currentSlide = 0;
let phraseInterval = null;
let puzzleCompleted = false;

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    initMenu();
    initFlipCard();
    initFleeingMachine();
    initPuzzle();
    initScrollToTop();
    initFormHandler();
    initParallax();
    loadPhrases();
    loadSlider();
});

// ============================================
// MENÚ FLOTANTE
// ============================================
function initMenu() {
    const menuToggle = document.getElementById('menuToggle');
    const menuNav = document.getElementById('menuNav');
    const menuItems = document.querySelectorAll('.menu-item');
    
    // Toggle menú
    menuToggle.addEventListener('click', function(e) {
        e.stopPropagation();
        menuNav.classList.toggle('active');
    });
    
    // Cerrar menú al hacer clic fuera
    document.addEventListener('click', function(e) {
        if (!menuNav.contains(e.target) && !menuToggle.contains(e.target)) {
            menuNav.classList.remove('active');
        }
    });
    
    // Cerrar menú y marcar activo al hacer clic en item
    menuItems.forEach(item => {
        item.addEventListener('click', function(e) {
            menuItems.forEach(i => i.classList.remove('active'));
            this.classList.add('active');
            menuNav.classList.remove('active');
        });
    });
    
    // Intersection Observer para marcar sección activa
    const sections = document.querySelectorAll('.section');
    const observerOptions = {
        threshold: 0.3
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const sectionId = entry.target.id;
                menuItems.forEach(item => {
                    item.classList.remove('active');
                    if (item.getAttribute('href') === `#${sectionId}`) {
                        item.classList.add('active');
                    }
                });
            }
        });
    }, observerOptions);
    
    sections.forEach(section => observer.observe(section));
}

// ============================================
// TARJETA GIRATORIA (FLIP CARD)
// ============================================
function initFlipCard() {
    const flipCard = document.getElementById('flipCard');
    const flipCardInner = document.getElementById('flipCardInner');
    let isFlipped = false;
    
    flipCard.addEventListener('click', function() {
        isFlipped = !isFlipped;
        if (isFlipped) {
            flipCardInner.classList.add('flipped');
        } else {
            flipCardInner.classList.remove('flipped');
        }
    });
}

// ============================================
// MÁQUINA QUE HUYE DEL CURSOR
// ============================================
function initFleeingMachine() {
    const machine = document.getElementById('fleeingMachine');
    const homeSection = document.querySelector('.section-home');
    const sectionBorder = homeSection ? homeSection.querySelector('.section-border') : null;
    
    if (!machine || !homeSection || !sectionBorder) return;
    
    // Posición inicial aleatoria dentro del borde
    let machineX = Math.random() * (sectionBorder.offsetWidth - 80);
    let machineY = Math.random() * (sectionBorder.offsetHeight - 80);
    machine.style.left = machineX + 'px';
    machine.style.top = machineY + 'px';
    
    // Escuchar mousemove en toda la sección
    homeSection.addEventListener('mousemove', function(e) {
        const borderRect = sectionBorder.getBoundingClientRect();
        const mouseX = e.clientX - borderRect.left;
        const mouseY = e.clientY - borderRect.top;
        
        // Calcular distancia entre cursor y máquina
        const dx = mouseX - (machineX + 40);
        const dy = mouseY - (machineY + 40);
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Si el cursor está cerca (menos de 200px), huir más rápido
        if (distance < 200) {
            const angle = Math.atan2(dy, dx);
            const speed = 10; // Duplicada la velocidad
            
            machineX -= Math.cos(angle) * speed;
            machineY -= Math.sin(angle) * speed;
            
            // Mantener dentro de los límites del borde (con rebote)
            const maxX = sectionBorder.offsetWidth - 80;
            const maxY = sectionBorder.offsetHeight - 80;
            
            if (machineX < 0) machineX = 0;
            if (machineX > maxX) machineX = maxX;
            if (machineY < 0) machineY = 0;
            if (machineY > maxY) machineY = maxY;
            
            machine.style.left = machineX + 'px';
            machine.style.top = machineY + 'px';
        }
    });
    
    // Bloquear clicks en la máquina
    machine.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
    });
}

// ============================================
// ROMPECABEZAS MEJORADO
// ============================================
function initPuzzle() {
    const puzzleContainer = document.getElementById('puzzleContainer');
    if (!puzzleContainer) return;
    
    // Si ya está completo, no hacer nada
    if (puzzleCompleted) {
        renderCompletedPuzzle(puzzleContainer);
        return;
    }
    
    const isMobile = window.innerWidth < 768;
    const pieces = 9;
    
    // Esperar a que el contenedor tenga dimensiones
    setTimeout(() => {
        const containerSize = puzzleContainer.clientWidth;
        const containerHeight = puzzleContainer.clientHeight;
        const pieceSize = Math.min(containerSize, containerHeight - 30) / 3;
        
        // Limpiar contenedor
        puzzleContainer.innerHTML = '';
        
        // Crear botón de reinicio
        const resetButton = createResetButton(puzzleContainer);
        puzzleContainer.appendChild(resetButton);
        
        // Crear piezas
        const puzzlePieces = [];
        for (let i = 0; i < pieces; i++) {
            const piece = document.createElement('div');
            piece.className = 'puzzle-piece';
            piece.dataset.index = i;
            piece.dataset.correctX = (i % 3) * pieceSize;
            piece.dataset.correctY = Math.floor(i / 3) * pieceSize;
            
            const img = document.createElement('img');
            img.src = `data/img/pieces-${String(i + 1).padStart(2, '0')}.png`;
            img.style.width = pieceSize + 'px';
            img.style.height = pieceSize + 'px';
            img.style.pointerEvents = 'none';
            img.draggable = false;
            piece.appendChild(img);
            
            puzzlePieces.push(piece);
        }
        
        // Mezclar posiciones
        const shuffled = shuffleArray([...puzzlePieces]);
        shuffled.forEach((piece, index) => {
            const randomX = Math.random() * (containerSize - pieceSize);
            const randomY = Math.random() * (containerSize - pieceSize);
            piece.style.left = randomX + 'px';
            piece.style.top = randomY + 'px';
            piece.style.position = 'absolute';
            piece.style.zIndex = index + 1;
            puzzleContainer.appendChild(piece);
        });
        
        if (isMobile) {
            setTimeout(() => {
                autoSolvePuzzle(puzzlePieces, pieceSize);
            }, 1000);
        } else {
            puzzlePieces.forEach(piece => {
                makeDraggable(piece, puzzleContainer, pieceSize);
            });
        }
        
        // Verificar si está completo
        checkPuzzleCompletion(puzzleContainer);
    }, 100);
}

function createResetButton(container) {
    const button = document.createElement('button');
    button.className = 'puzzle-reset-button';
    button.innerHTML = `
        <svg viewBox="0 0 24 24" width="24" height="24">
            <path fill="currentColor" d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
        </svg>
    `;
    button.title = 'Revolver puzzle';
    
    button.addEventListener('click', (e) => {
        e.stopPropagation();
        puzzleCompleted = false;
        initPuzzle();
    });
    
    return button;
}

function checkPuzzleCompletion(container) {
    const checkInterval = setInterval(() => {
        const pieces = container.querySelectorAll('.puzzle-piece');
        const correctPieces = container.querySelectorAll('.puzzle-piece.correct');
        
        if (correctPieces.length === pieces.length) {
            puzzleCompleted = true;
            clearInterval(checkInterval);
        }
    }, 500);
}

function renderCompletedPuzzle(container) {
    const containerSize = container.clientWidth;
    const containerHeight = container.clientHeight;
    const pieceSize = Math.min(containerSize, containerHeight - 30) / 3;
    
    container.innerHTML = '';
    
    // Crear botón de reinicio
    const resetButton = createResetButton(container);
    container.appendChild(resetButton);
    
    // Crear piezas en su posición correcta
    for (let i = 0; i < 9; i++) {
        const piece = document.createElement('div');
        piece.className = 'puzzle-piece correct';
        piece.style.position = 'absolute';
        piece.style.left = (i % 3) * pieceSize + 'px';
        piece.style.top = Math.floor(i / 3) * pieceSize + 'px';
        
        const img = document.createElement('img');
        img.src = `data/img/pieces-${String(i + 1).padStart(2, '0')}.png`;
        img.style.width = pieceSize + 'px';
        img.style.height = pieceSize + 'px';
        piece.appendChild(img);
        
        container.appendChild(piece);
    }
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function makeDraggable(element, container, pieceSize) {
    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;
    
    // Mouse events
    element.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);
    
    // Touch events
    element.addEventListener('touchstart', dragStart, { passive: false });
    document.addEventListener('touchmove', drag, { passive: false });
    document.addEventListener('touchend', dragEnd);
    
    function dragStart(e) {
        if (element.classList.contains('correct')) return;
        
        e.preventDefault();
        isDragging = true;
        
        const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
        const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
        
        const rect = element.getBoundingClientRect();
        offsetX = clientX - rect.left;
        offsetY = clientY - rect.top;
        
        element.style.zIndex = 2000;
        
        // Bajar z-index de otras piezas que no están siendo arrastradas
        const allPieces = container.querySelectorAll('.puzzle-piece:not(.correct)');
        allPieces.forEach(p => {
            if (p !== element && parseInt(p.style.zIndex) >= 2000) {
                p.style.zIndex = parseInt(p.style.zIndex) - 1;
            }
        });
    }
    
    function drag(e) {
        if (!isDragging) return;
        
        e.preventDefault();
        
        const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
        const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
        
        const containerRect = container.getBoundingClientRect();
        
        // Calcular nueva posición relativa al contenedor
        let newX = clientX - containerRect.left - offsetX;
        let newY = clientY - containerRect.top - offsetY;
        
        // Aplicar límites
        const maxX = container.clientWidth - pieceSize;
        const maxY = container.clientHeight - pieceSize;
        
        newX = Math.max(0, Math.min(newX, maxX));
        newY = Math.max(0, Math.min(newY, maxY));
        
        element.style.left = newX + 'px';
        element.style.top = newY + 'px';
    }
    
    function dragEnd() {
        if (!isDragging) return;
        isDragging = false;
        element.style.zIndex = 1;
        
        // Verificar si está cerca de su posición correcta
        const correctX = parseFloat(element.dataset.correctX);
        const correctY = parseFloat(element.dataset.correctY);
        const currentX = parseFloat(element.style.left);
        const currentY = parseFloat(element.style.top);
        
        const tolerance = pieceSize * 0.3;
        
        if (Math.abs(currentX - correctX) < tolerance && Math.abs(currentY - correctY) < tolerance) {
            element.style.left = correctX + 'px';
            element.style.top = correctY + 'px';
            element.classList.add('correct');
        }
    }
}

function autoSolvePuzzle(pieces, pieceSize) {
    pieces.forEach((piece, index) => {
        setTimeout(() => {
            const correctX = parseInt(piece.dataset.correctX);
            const correctY = parseInt(piece.dataset.correctY);
            piece.style.transition = 'all 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
            piece.style.left = correctX + 'px';
            piece.style.top = correctY + 'px';
            piece.classList.add('correct');
        }, index * 200);
    });
}

// ============================================
// CARGAR FRASES DESDE JSON
// ============================================
async function loadPhrases() {
    try {
        const response = await fetch('data/js/phrases.json');
        const data = await response.json();
        phrasesData = data.frases;
        
        // Iniciar rotación de frases
        displayRandomPhrase();
        
        // Configurar intervalo (convertir minutos a milisegundos)
        const intervalMinutes = data.intervalo_minutos || 10;
        phraseInterval = setInterval(displayRandomPhrase, intervalMinutes * 60 * 1000);
        
    } catch (error) {
        console.error('Error cargando frases:', error);
    }
}

function displayRandomPhrase() {
    if (phrasesData.length === 0) return;
    
    // Crear array de índices disponibles
    const availableIndices = [...Array(phrasesData.length).keys()];
    const selectedIndices = [];
    
    // Seleccionar 3 frases diferentes aleatorias
    for (let i = 0; i < 3 && availableIndices.length > 0; i++) {
        const randomIdx = Math.floor(Math.random() * availableIndices.length);
        selectedIndices.push(availableIndices[randomIdx]);
        availableIndices.splice(randomIdx, 1);
    }
    
    // Actualizar cada micro-sección con una frase diferente
    for (let i = 1; i <= 3; i++) {
        const phraseSection = document.getElementById(`phrase${i}`);
        if (phraseSection && selectedIndices[i - 1] !== undefined) {
            const phrase = phrasesData[selectedIndices[i - 1]];
            
            const textEl = phraseSection.querySelector('.phrase-text');
            const storyEl = phraseSection.querySelector('.phrase-story');
            const publicationEl = phraseSection.querySelector('.phrase-publication');
            
            if (textEl) textEl.textContent = `"${phrase.frase}"`;
            if (storyEl) storyEl.textContent = phrase.titulo;
            if (publicationEl) publicationEl.textContent = phrase.publicacion;
        }
    }
}

// ============================================
// CARGAR SLIDER DESDE JSON
// ============================================
async function loadSlider() {
    try {
        const response = await fetch('data/js/slider.json');
        sliderData = await response.json();
        renderSlider();
        initSliderControls();
    } catch (error) {
        console.error('Error cargando slider:', error);
    }
}

function renderSlider() {
    const sliderTrack = document.getElementById('sliderTrack');
    if (!sliderTrack) return;
    
    sliderTrack.innerHTML = '';
    
    sliderData.forEach((slide, index) => {
        const slideEl = document.createElement('div');
        slideEl.className = 'slide';
        slideEl.innerHTML = `
            <div class="slide-left">
                <h3>${slide.titulo}</h3>
                <p class="slide-author">${slide.autor}</p>
                <p class="slide-opinion">${slide.opinion}</p>
            </div>
            <div class="slide-right">
                <img src="data/img/${slide.imagen}" alt="${slide.titulo}" class="slide-image">
            </div>
        `;
        sliderTrack.appendChild(slideEl);
    });
}

function initSliderControls() {
    const sliderPrev = document.getElementById('sliderPrev');
    const sliderNext = document.getElementById('sliderNext');
    const sliderTrack = document.getElementById('sliderTrack');
    
    if (!sliderPrev || !sliderNext || !sliderTrack) return;
    
    sliderPrev.addEventListener('click', () => {
        currentSlide--;
        
        // Si llega antes del primero, ir al último
        if (currentSlide < 0) {
            currentSlide = sliderData.length - 1;
        }
        
        updateSlider();
    });
    
    sliderNext.addEventListener('click', () => {
        currentSlide++;
        
        // Si llega después del último, ir al primero
        if (currentSlide >= sliderData.length) {
            currentSlide = 0;
        }
        
        updateSlider();
    });
}

function updateSlider() {
    const sliderTrack = document.getElementById('sliderTrack');
    if (!sliderTrack) return;
    
    const slideWidth = sliderTrack.querySelector('.slide').offsetWidth;
    sliderTrack.style.transform = `translateX(-${currentSlide * slideWidth}px)`;
}

// ============================================
// BOTÓN SCROLL TO TOP
// ============================================
function initScrollToTop() {
    const scrollBtn = document.getElementById('scrollToTop');
    const homeSection = document.getElementById('inicio');
    const amistadSection = document.getElementById('amistad-nigromante');
    const cemeterySection = document.getElementById('cementerio-nigromante');
    
    if (!scrollBtn || !cemeterySection) return;
    
    // Mostrar desde cementerio
    const showObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                scrollBtn.classList.add('visible');
            }
        });
    }, { threshold: 0.1 });
    
    showObserver.observe(cemeterySection);
    
    // Ocultar en home y amistad
    const hideObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                scrollBtn.classList.remove('visible');
            }
        });
    }, { threshold: 0.3 });
    
    if (homeSection) hideObserver.observe(homeSection);
    if (amistadSection) hideObserver.observe(amistadSection);
    
    // Click para subir
    scrollBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

// ============================================
// FORMULARIO DE CONTACTO
// ============================================
function initFormHandler() {
    const form = document.getElementById('contactForm');
    if (!form) return;
    
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const message = document.getElementById('message').value;
        
        // Crear enlace mailto
        const subject = encodeURIComponent(`Mensaje de ${name} desde el sitio web`);
        const body = encodeURIComponent(`Nombre: ${name}\nEmail: ${email}\n\nMensaje:\n${message}`);
        const mailtoLink = `mailto:jazeem.amezcua@gmail.com?subject=${subject}&body=${body}`;
        
        window.location.href = mailtoLink;
        
        // Limpiar formulario
        form.reset();
    });
}

// ============================================
// EFECTO PARALLAX
// ============================================
function initParallax() {
    window.addEventListener('scroll', function() {
        const scrolled = window.pageYOffset;
        
        // Parallax en sección home
        const homeSection = document.querySelector('.section-home');
        if (homeSection) {
            const homeContent = homeSection.querySelector('.home-content');
            if (homeContent) {
                const sectionTop = homeSection.offsetTop;
                const offset = scrolled - sectionTop;
                if (offset > 0 && offset < homeSection.offsetHeight) {
                    homeContent.style.transform = `translateY(${offset * 0.3}px)`;
                }
            }
        }
    });
}

// ============================================
// SMOOTH SCROLL PARA ENLACES INTERNOS
// ============================================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        const href = this.getAttribute('href');
        
        // Validar que sea una ancla local válida
        if (href && href.startsWith('#') && href.length > 1) {
            // Solo procesar si es un ID válido (sin caracteres especiales de URL)
            const isValidSelector = /^#[a-zA-Z0-9_-]+$/.test(href);
            
            if (isValidSelector) {
                e.preventDefault();
                try {
                    const target = document.querySelector(href);
                    if (target) {
                        target.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start'
                        });
                    }
                } catch (error) {
                    console.log('Error al navegar a:', href);
                }
            }
        }
    });
});

// ============================================
// UTILIDADES
// ============================================
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Redimensionar slider en responsive
window.addEventListener('resize', debounce(function() {
    updateSlider();
    
    // Solo reiniciar puzzle si no está completo
    const puzzleContainer = document.getElementById('puzzleContainer');
    if (puzzleContainer && !puzzleCompleted) {
        puzzleContainer.innerHTML = '';
        initPuzzle();
    } else if (puzzleContainer && puzzleCompleted) {
        // Si está completo, solo re-renderizar
        renderCompletedPuzzle(puzzleContainer);
    }
}, 250));


// ============================================
// CONTADOR DE VISITANTES
// ============================================
// ============================================
// CONTADOR DE VISITANTES CON COUNTAPI
// ============================================
// async function initVisitorCounter() {
//     const countElement = document.getElementById('visitorCount');
//     if (!countElement) return;
    
//     try {
//         // Verificar si ya visitó en esta sesión
//         const hasVisited = sessionStorage.getItem('visited');
        
//         if (!hasVisited) {
//             // Primera visita - incrementar contador
//             const response = await fetch('https://api.countapi.xyz/hit/jazeem-nigromante-site/visits');
//             const data = await response.json();
            
//             sessionStorage.setItem('visited', 'true');
//             animateCounter(countElement, data.value);
//         } else {
//             // Ya visitó - solo obtener el número actual
//             const response = await fetch('https://api.countapi.xyz/get/jazeem-nigromante-site/visits');
//             const data = await response.json();
            
//             animateCounter(countElement, data.value);
//         }
        
//     } catch (error) {
//         console.error('Error con CountAPI:', error);
//         // Fallback a contador local
//         let count = parseInt(localStorage.getItem('visitorCount') || '0');
        
//         if (!sessionStorage.getItem('visited')) {
//             count++;
//             localStorage.setItem('visitorCount', count.toString());
//             sessionStorage.setItem('visited', 'true');
//         }
        
//         countElement.textContent = count.toLocaleString();
//     }
// }

// function animateCounter(element, targetCount) {
//     let current = 0;
//     const increment = Math.ceil(targetCount / 50);
//     const duration = 1500;
//     const stepTime = duration / (targetCount / increment);
    
//     const timer = setInterval(() => {
//         current += increment;
//         if (current >= targetCount) {
//             current = targetCount;
//             clearInterval(timer);
//         }
//         element.textContent = current.toLocaleString();
//     }, stepTime);
// }


// ============================================
// CEMETERY PAGE - FUNCIONES
// ============================================

// Verificar si estamos en la página del cementerio
if (document.querySelector('.cemetery-page')) {
    document.addEventListener('DOMContentLoaded', function() {
        initCemeteryPage();
        initCemeteryScrollToTop();
        initFormHandler(); // Reutilizar del index
        initVisitorCounter(); // Reutilizar del index
    });
}

// ============================================
// INICIALIZAR PÁGINA DEL CEMENTERIO
// ============================================
async function initCemeteryPage() {
    try {
        const response = await fetch('js/cemetery.json');
        const stories = await response.json();
        
        renderStoriesByYear(stories);
        initStoryModals(stories);
        
    } catch (error) {
        console.error('Error cargando cuentos:', error);
        document.getElementById('storiesContainer').innerHTML = `
            <p style="color: var(--color-hueso); text-align: center; padding: 40px;">
                Error cargando los cuentos. Por favor, recarga la página.
            </p>
        `;
    }
}

// ============================================
// RENDERIZAR CUENTOS POR AÑO
// ============================================
function renderStoriesByYear(stories) {
    const container = document.getElementById('storiesContainer');
    if (!container) return;
    
    // Agrupar cuentos por año
    const storyByYear = {
        '2021: Cuarentena': [],
        '2022: Semilla de sombras': [],
        '2023: Sueños y palabras': [],
        '2024: Pasitos al cósmos': [],
        '2025: Tinta y estrellas': [],
        '2026: El ahora esta por tener nombre': []
    };
    
    stories.forEach(story => {
        if (storyByYear[story.yearSection]) {
            storyByYear[story.yearSection].push(story);
        }
    });
    
    // Renderizar cada año
    let html = '';
    
    Object.entries(storyByYear).forEach(([yearTitle, yearStories]) => {
        if (yearStories.length === 0) return;
        
        const yearId = yearTitle.split(':')[0].trim(); // "2021"
        
        html += `
            <div class="year-section" id="year-${yearId}">
                <h2 class="year-section-title">${yearTitle}</h2>
                <div class="stories-grid">
        `;
        
        yearStories.forEach(story => {
            html += `
                <button class="story-button" data-story-id="${story.id}">
                    <img src="img/icon-story.svg" alt="${story.titulo}">
                    <span class="story-title">${story.titulo}</span>
                </button>
            `;
        });
        
        html += `
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// ============================================
// INICIALIZAR MODALES DE CUENTOS
// ============================================
function initStoryModals(stories) {
    const modal = document.getElementById('storyModal');
    const closeBtn = document.getElementById('closeModal');
    const storyButtons = document.querySelectorAll('.story-button');
    
    if (!modal || !closeBtn) return;
    
    // Abrir modal al hacer clic en un cuento
    storyButtons.forEach(button => {
        button.addEventListener('click', function() {
            const storyId = parseInt(this.dataset.storyId);
            const story = stories.find(s => s.id === storyId);
            
            if (story) {
                openStoryModal(story);
            }
        });
    });
    
    // Cerrar modal con botón X
    closeBtn.addEventListener('click', closeStoryModal);
    
    // Cerrar modal al hacer clic fuera del contenido
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeStoryModal();
        }
    });
    
    // Cerrar modal con tecla ESC
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeStoryModal();
        }
    });
}

// ============================================
// ABRIR MODAL CON DATOS DEL CUENTO
// ============================================
function openStoryModal(story) {
    const modal = document.getElementById('storyModal');
    
    // Llenar datos
    document.getElementById('modalYear').textContent = story.yearSection;
    document.getElementById('modalTitle').textContent = story.titulo;
    document.getElementById('modalAnioEscrito').textContent = story.anioEscrito;
    document.getElementById('modalAnioPublicado').textContent = `${story.anioPublicado} (${story.mesPublicado})`;
    document.getElementById('modalTemas').textContent = story.temas;
    document.getElementById('modalPublicacion').textContent = story.publicacion;
    document.getElementById('modalEditorial').textContent = story.editorial;
    document.getElementById('modalTipo').textContent = story.tipo;
    
    // Portada
    const portada = document.getElementById('modalPortada');
    portada.src = story.portada;
    portada.alt = `Portada de ${story.titulo}`;
    
    // Botón de descarga
    const downloadBtn = document.getElementById('modalDownloadButton');
    
    if (story.descarga && story.descarga !== null) {
        downloadBtn.textContent = 'Bajar y leer';
        downloadBtn.classList.remove('disabled');
        downloadBtn.classList.add('active');
        downloadBtn.onclick = function() {
            window.open(story.descarga, '_blank');
        };
    } else {
        downloadBtn.textContent = 'Próximamente';
        downloadBtn.classList.add('disabled');
        downloadBtn.classList.remove('active');
        downloadBtn.onclick = null;
    }
    
    // Botón de enlace
    const linkBtn = document.getElementById('modalLinkButton');
    
    if (story.link && story.link !== null) {
        linkBtn.href = story.link;
        linkBtn.classList.remove('hidden');
    } else {
        linkBtn.classList.add('hidden');
    }
    
    // Mostrar modal
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// ============================================
// CERRAR MODAL
// ============================================
function closeStoryModal() {
    const modal = document.getElementById('storyModal');
    modal.classList.remove('active');
    document.body.style.overflow = 'auto';
}

// ============================================
// SCROLL TO TOP (CEMETERY)
// ============================================
function initCemeteryScrollToTop() {
    const scrollBtn = document.getElementById('scrollToTopCemetery');
    if (!scrollBtn) return;
    
    // Mostrar/ocultar según scroll
    window.addEventListener('scroll', function() {
        if (window.pageYOffset > 300) {
            scrollBtn.classList.add('visible');
        } else {
            scrollBtn.classList.remove('visible');
        }
    });
    
    // Click para subir
    scrollBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}



// Inicializar contador cuando cargue la página
// document.addEventListener('DOMContentLoaded', function() {
//      ... código existente ...
//     initVisitorCounter();
// });


