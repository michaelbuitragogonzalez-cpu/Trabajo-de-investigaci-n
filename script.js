
const DOCUMENTOS = [
  {
    titulo: "Propuesta de investigación",
    descripcion: "Planteamiento, objetivos y metodología del trabajo.",
    tipo: "word",
    archivo: null            // ← cuando la tengas: "archivos/Propuesta.docx"
  },
  {
    titulo: "Árbol de problemas",
    descripcion: "Problema central, causas y efectos de la vulnerabilidad en redes Wi-Fi.",
    tipo: "pdf",
    archivo: "archivos/Arbol_de_problemas.pdf"
  },
  {
    titulo: "Bitácora de campo",
    descripcion: "Registro de la visita a la Institución Educativa Manuel Antonio Bonilla.",
    tipo: "pdf",
    archivo: "archivos/Bitacora.pdf"
  },
  {
    titulo: "Estado del arte",
    descripcion: "Revisión de las fuentes y antecedentes de la investigación.",
    tipo: "excel",
    archivo: "archivos/Estado_del_Arte.xlsx"
  },
];

const NOMBRE_TIPO = { pdf: "PDF", word: "Word", excel: "Excel" };

/* ---------- Tarjetas ---------- */
const contenedor = document.getElementById("cajones");

DOCUMENTOS.forEach((doc, i) => {
  const pendiente = !doc.archivo;
  const tarjeta = document.createElement("article");
  tarjeta.className = "cajon";
  tarjeta.dataset.tipo = pendiente ? "pendiente" : doc.tipo;
  tarjeta.style.transitionDelay = `${i * 90}ms`;

  tarjeta.innerHTML = `
    <span class="etiqueta">${pendiente ? "Próximamente" : NOMBRE_TIPO[doc.tipo]}</span>
    <h3>${doc.titulo}</h3>
    <p>${doc.descripcion}</p>
    <div class="acciones">
      ${pendiente
        ? `<span class="pendiente-texto">Se agregará pronto</span>`
        : `<button class="btn" data-ver="${i}">Ver documento</button>
           <a class="btn btn-claro" href="${doc.archivo}" download>Descargar</a>`}
    </div>`;
  contenedor.appendChild(tarjeta);
});

/* Aparecen una sola vez al llegar a la sección */
const observador = new IntersectionObserver((entradas) => {
  entradas.forEach((e) => {
    if (e.isIntersecting) {
      e.target.classList.add("visible");
      observador.unobserve(e.target);
    }
  });
}, { threshold: 0.15 });
document.querySelectorAll(".cajon").forEach((c) => observador.observe(c));

/* Quita el retraso escalonado después de aparecer, para que el hover responda al instante */
contenedor.addEventListener("transitionend", (e) => {
  if (e.propertyName === "opacity") e.target.style.transitionDelay = "0ms";
});

/* ---------- Visor ---------- */
const visor = document.getElementById("visor");
const cuerpo = document.getElementById("visor-cuerpo");
const tituloVisor = document.getElementById("visor-titulo");
const descarga = document.getElementById("visor-descarga");
let ultimoBoton = null;

contenedor.addEventListener("click", (e) => {
  const boton = e.target.closest("[data-ver]");
  if (!boton) return;
  ultimoBoton = boton;
  abrirVisor(DOCUMENTOS[boton.dataset.ver]);
});

visor.addEventListener("click", (e) => {
  if (e.target.closest("[data-cerrar]")) cerrarVisor();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && visor.classList.contains("abierto")) cerrarVisor();
});

function abrirVisor(doc) {
  tituloVisor.textContent = doc.titulo;
  descarga.href = doc.archivo;
  cuerpo.innerHTML = `<p class="visor-estado">Cargando…</p>`;
  visor.classList.add("abierto");
  visor.setAttribute("aria-hidden", "false");
  document.body.classList.add("sin-scroll");

  if (doc.tipo === "pdf") mostrarPdf(doc.archivo);
  else if (doc.tipo === "word") mostrarWord(doc.archivo);
  else mostrarExcel();
}

function cerrarVisor() {
  visor.classList.remove("abierto");
  visor.setAttribute("aria-hidden", "true");
  document.body.classList.remove("sin-scroll");
  setTimeout(() => (cuerpo.innerHTML = ""), 400);
  if (ultimoBoton) ultimoBoton.focus();
}

function mostrarError(mensaje) {
  cuerpo.innerHTML = `<p class="visor-estado error">${mensaje}</p>`;
}

const MENSAJE_SERVIDOR =
  "No se pudo abrir el archivo. Abre el proyecto con Live Server en VS Code (clic derecho en index.html → Open with Live Server) o usa el botón Descargar.";

/* PDF: se dibuja con PDF.js para que funcione también en celulares.
   Si algo falla, se usa el visor del propio navegador como respaldo. */
async function mostrarPdf(ruta) {
  try {
    await cargarScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js");
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    const pdf = await pdfjsLib.getDocument(ruta).promise;
    const paginas = document.createElement("div");
    paginas.className = "pdf-paginas";
    cuerpo.innerHTML = "";
    cuerpo.appendChild(paginas);

    const ancho = Math.min(cuerpo.clientWidth - 24, 960);
    const nitidez = Math.min(window.devicePixelRatio || 1, 2);

    for (let n = 1; n <= pdf.numPages; n++) {
      if (!visor.classList.contains("abierto")) return;   // se cerró mientras cargaba
      const pagina = await pdf.getPage(n);
      const base = pagina.getViewport({ scale: 1 });
      const vista = pagina.getViewport({ scale: (ancho / base.width) * nitidez });
      const lienzo = document.createElement("canvas");
      lienzo.width = vista.width;
      lienzo.height = vista.height;
      paginas.appendChild(lienzo);
      await pagina.render({ canvasContext: lienzo.getContext("2d"), viewport: vista }).promise;
    }
  } catch (err) {
    cuerpo.innerHTML = `<iframe src="${ruta}" title="Documento PDF"></iframe>`;
  }
}

/* Word: se convierte a HTML con la librería Mammoth */
async function mostrarWord(ruta) {
  try {
    await cargarScript("https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js");
    const datos = await (await fetch(ruta)).arrayBuffer();
    const { value } = await mammoth.convertToHtml({ arrayBuffer: datos });
    cuerpo.innerHTML = `<div class="word-contenido">${value}</div>`;
  } catch (err) {
    mostrarError(MENSAJE_SERVIDOR);
  }
}

/* Excel: se dibuja desde los datos incrustados (estado_del_arte_datos.js),
   así se ve siempre, sin servidor ni internet. */
function escapar(t) {
  return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function mostrarExcel() {
  const datos = window.ESTADO_ARTE;
  if (!datos) { mostrarError("No se encontraron los datos del Estado del arte."); return; }

  const celda = (c) => {
    if (c && typeof c === "object") {
      return `<a href="${escapar(c.l)}" target="_blank" rel="noopener">${escapar(c.t.length > 38 ? "Abrir artículo" : c.t)}</a>`;
    }
    return escapar(c);
  };

  const cabecera = datos.headers.map((h) => `<th>${escapar(h)}</th>`).join("");
  const filas = datos.rows.map((fila) =>
    `<tr>${fila.map((c, i) => `<td data-etiqueta="${escapar(datos.headers[i])}">${celda(c)}</td>`).join("")}</tr>`
  ).join("");

  cuerpo.innerHTML = `
    <div class="tabla-excel">
      <div class="excel-barra">
        <p class="excel-nota">${datos.rows.length} fuentes revisadas. Usa las flechas o arrastra la tabla para ver todas las columnas.</p>
        <button class="excel-flecha" data-lado="-1" aria-label="Columnas anteriores">&#9664;</button>
        <button class="excel-flecha" data-lado="1" aria-label="Más columnas">&#9654;</button>
      </div>
      <div class="scroll" id="excel-scroll"><table><thead><tr>${cabecera}</tr></thead><tbody>${filas}</tbody></table></div>
    </div>`;

  activarDeslizado(document.getElementById("excel-scroll"));
}

/* Flechas y arrastre con el mouse para mover la tabla de lado */
function activarDeslizado(zona) {
  document.querySelectorAll(".excel-flecha").forEach((b) =>
    b.addEventListener("click", () =>
      zona.scrollBy({ left: b.dataset.lado * zona.clientWidth * 0.7 }))
  );

  let activo = false, inicioX = 0, inicioY = 0, izq = 0, arriba = 0;
  zona.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse" || e.target.closest("a")) return;
    activo = true; inicioX = e.clientX; inicioY = e.clientY;
    izq = zona.scrollLeft; arriba = zona.scrollTop;
    zona.classList.add("arrastrando");
  });
  window.addEventListener("pointermove", (e) => {
    if (!activo) return;
    zona.scrollLeft = izq - (e.clientX - inicioX);
    zona.scrollTop = arriba - (e.clientY - inicioY);
  });
  window.addEventListener("pointerup", () => {
    activo = false; zona.classList.remove("arrastrando");
  });
}

const scriptsCargados = {};
function cargarScript(url) {
  if (!scriptsCargados[url]) {
    scriptsCargados[url] = new Promise((ok, fallo) => {
      const s = document.createElement("script");
      s.src = url; s.onload = ok; s.onerror = fallo;
      document.head.appendChild(s);
    });
  }
  return scriptsCargados[url];
}
