

var data = document.getElementById('ArchivoPdf').value; 
var a = document.createElement('a'); a.href = 'data:application/pdf;base64,' + data; a.download = 'archivo.pdf'; document.body.appendChild(a); a.click(); document.body.removeChild(a);


// ==========================================
// ==========================================
// 1. Encontrar todos los campos ocultos
// ==========================================
// ==========================================
var hiddenFields = document.querySelectorAll('input[type="hidden"]');

// 2. Enlistarlos en la consola con sus detalles
console.log("--- Enlistando " + hiddenFields.length + " Campos Ocultos Encontrados ---");
hiddenFields.forEach(function(field, index) {
    // Mostrar ID, nombre y un fragmento del valor
    console.log("Campo #" + (index + 1) + ":", 
        "ID: " + (field.id || "N/A"), 
        "| Name: " + (field.name || "N/A"), 
        "| Value (fragmento): " + (field.value ? field.value.substring(0, 70) + "..." : "N/A")
    );
});
console.log("--- Fin de la lista ---");

// 3. Cambiar su tipo a 'text' para hacerlos visibles en la página
hiddenFields.forEach(function(field) {
    field.type = 'text';
});

console.log("Acción completada: " + hiddenFields.length + " campos ahora son visibles en la página.");



// ====================================
// ====================================
// Enlistar campos HIDDEN a text
// ====================================
// ====================================
// 1. Encontrar todos los campos ocultos
var hiddenFields = document.querySelectorAll('input[type="hidden"]');

// 2. Enlistarlos en la consola con sus detalles
console.log("--- Enlistando " + hiddenFields.length + " Campos Ocultos Encontrados ---");
hiddenFields.forEach(function(field, index) {
    // Mostrar ID, nombre y un fragmento del valor
    console.log("Campo #" + (index + 1) + ":", 
        "ID: " + (field.id || "N/A"), 
        "| Name: " + (field.name || "N/A"), 
        "| Value (fragmento): " + (field.value ? field.value.substring(0, 70) + "..." : "N/A")
    );
});
console.log("--- Fin de la lista ---");

// 3. Cambiar su tipo a 'text' para hacerlos visibles en la página
hiddenFields.forEach(function(field) {
    field.type = 'text';
});

console.log("Acción completada: " + hiddenFields.length + " campos ahora son visibles en la página.");



/**
 * --- Función: Analizar y Abrir Iframe en Nueva Ventana ---
 *
 * Esta función localiza el iframe principal del modal,
 * extrae su información (src y #document) para mostrarla en la consola,
 * y luego abre el 'src' de ese iframe en una nueva ventana.
 */
var data = document.getElementById('ArchivoPdf').value;
var a = document.createElement('a');
a.href = 'data:application/pdf;base64,' + data;
a.download = 'documento_completo.pdf';
document.body.appendChild(a);
a.click();
document.body.removeChild(a);











