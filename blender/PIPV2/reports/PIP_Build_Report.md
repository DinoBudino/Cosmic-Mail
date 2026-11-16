# PIP V2 — Informe de construcción

Fuente visual: `reference/pip_reference.png` (ficha de personaje Cosmic Mail). Construido en el Blender vivo mediante Blender MCP.

## Datos
| Ítem | Valor |
|---|---|
| Blender | 5.2.3 LTS (EEVEE; Cycles no se probó) |
| Herramientas MCP usadas | `get_addon_status`, `get_scene_info`, `execute_blender_code`, `look` |
| Archivo principal | `blender/PIPV2/PIP_CosmicMail_Final.blend` |
| Export secundario | `PIP_CosmicMail_Export.glb` (1,27 MB, sin animaciones/drivers) |
| Objetos de malla | 150 |
| Materiales | 28 |
| Expresiones | 10 (`EXP_01…09` de la ficha + `EXP_10` vista principal; visibilidad por driver) |
| Controladores | 8 empties en `00_CONTROLLERS` |
| Cámaras | 9 (8 de la especificación + `CAM_FACE_CLOSE`) |
| Resolución de renders | 1024×1024 (expresiones: 3×512) |
| Cámara activa / expresión inicial | `CAM_HERO` / `EXP_02_ALEGRE` |

## Estructura
`scripts/` contiene módulos reejecutables (idempotentes por etiqueta `pip_module`): `pip_config`, `pip_utils`, `run`, `00_initialize` … `11_validate_render`. Se ejecutan con `run_stage("NN_nombre")` desde el MCP. Parámetros centralizados en `pip_config.py`.

## Validaciones realizadas (con evidencia)
- Conexión real a Blender comprobada (versión, motor, escritura en ruta del proyecto).
- Drivers: 0 inválidos tras corregir los de propulsor (nombres de variable `i`/`p` fallaban; renombrados).
- Comprobación automática (`reports/validation.json`): 0 mallas vacías, 0 sin material, 0 caras degeneradas, 0 nombres duplicados, 0 objetos fuera de jerarquía.
- Inspección visual de los 8 renders y de la hoja de expresiones, comparados con la ficha.

## Iteración 2 (acercamiento a la ficha)
- Visor casi a ras (`visor_bulge` 0.03, `edge_lift` 0.012) y marco fino; visor algo mayor (0.79 × 0.60).
- Orejas: más grandes (×1.12), gris-azulado oscuro (`MAT_EAR_SLATE`), anillo amarillo-naranja fino, centro oscuro.
- Ojos y boca mayores; boca abierta más ancha.
- Bloom por compositor (Glare tipo Bloom, umbral 2.2) para ojos, anillos y propulsor.
- Propulsor ×1.3 con núcleo abultado, banda y halo emisivos.
- Franjas naranjas más anchas; panel trasero convertido en banda naranja sólida con borde.
- Resultado: 118 mallas, 20 materiales, 0 problemas en la validación automática, 0 drivers inválidos.

## Iteración 3 (comparación detallada con la ficha)
- **Expresiones rehechas** copiando la hoja "Expresiones de visor": Neutral (2 puntos), Alegre (ojos ^ ^ + sonrisa rellena), Guiño (ojo + guiño, sin boca), Emocionado, Curioso (ojos + punto), Analizando (retícula + círculo/cruz), Satisfecho (ojos cerrados ∪ + sonrisa pequeña), Sorprendido, Pensativo (3 puntos). Se añadió la variante 10 `EXP_10_ALEGRE_VISTA_PRINCIPAL` (ojo + guiño + sonrisa, la de la vista principal), que es la expresión inicial. Decisión: el prompt pedía Alegre = ojo + arco, pero la ficha muestra otra cosa en su hoja de expresiones; se priorizó la ficha.
- Franja inferior oscura (`SHELL_BELT_*`), placa gris inferior y filete bronce.
- Orejas en cúpula gris oscura con brida bronce y aro luminoso; centro oscuro brillante.
- Borde del visor en bronce fino; ranura/placa naranja superior central y placa gris; antena con base oscura y collar bronce.
- Propulsor: placa gris con bulbo semiesférico amarillo-naranja con degradado; sombra suave bajo el personaje.
- LED frontal/trasero con marco bronce, sensor oscuro, botón, rejillas traseras altas; banda trasera vertical.
- Exposición -0.35 para acercar el beige de la ficha. 125 mallas, 24 materiales, 0 problemas, 0 drivers inválidos.

## Iteración 4 (comparación lado a lado ficha | render)
Método: composiciones `ficha | render` por vista (principal, frontal, lateral, trasera, expresiones) con un script PIL.
- Visor más alto (centro z=0.10) y ancho, marco crema casi a ras con filete bronce.
- Orejas más pequeñas (escala 0.76), gris medio, centradas; aro bronce solo visible de frente; aro luminoso amarillo.
- Ojos y boca en ámbar para la hoja de expresiones; blanco rosado para la vista principal (`EXP_10`). Arcos más gruesos.
- Franjas naranjas: dos bandas casi horizontales en el lateral +X, de delante hacia atrás; acento naranja arriba-izquierda.
- Trasera: banda naranja rectangular desde la antena hasta la junta horizontal (z≈0.08) con remaches, rejillas a ambos lados, placa central, LED grande, juntas.
- Junta horizontal real entre carcasa superior y media; franja oscura con segmentos y pilotos; placa inferior oscura.
- Propulsor sin plato ancho: collar oscuro corto y bulbo amarillo-naranja.
- Antena con base dorada ancha, vástago grueso, bulbo mayor.
- Iluminación: luces de relleno sin especular (quitaban reflejos redondos tipo "ojo" en el visor) + tarjeta de reflejo elíptica.
- 150 mallas, 28 materiales, 0 problemas, 0 drivers inválidos.

## Problemas encontrados y correcciones
1. Antena y propulsor desplazados por matrices de padre obsoletas → `view_layer.update()` y re-parenting idempotente.
2. Acciones por capas de Blender 5 (sin `fcurves`) → acceso por strips/channelbags.
3. Acné de sombra en el casco inferior → la luz del propulsor no proyecta sombra.
4. Boca con artefactos → relleno por anillos concéntricos.
5. Drivers del propulsor inválidos (nombres `i`/`p`) → renombrados.
6. Bloom con rayas y velo marrón sobre el visor → tipo/calidad correctos y umbral alto.

## Limitaciones conocidas (honesto)
- El marco del visor aún sobresale algo en la vista lateral.
- Propulsor: se aproxima a la ficha pero no es una copia exacta (sin bulbo esférico amarillo).
- Franjas naranjas y parte trasera: aproximación de la ficha, no réplica.
- El interior de la boca es oscuro sobre visor negro (se lee como arco con lengua).
- No se crearon `VISOR_REFLECTION_DETAILS`, checkpoints `PIP_0x_*.blend`, microtexturas ni despiece interior.
- Solo EEVEE; sin Cycles ni renders ≥1600 px. Sin puntuación ponderada (no se afirma 9/10).
- Giro 360° en la acción `PIP_Turntable_360` (fake user, sin asignar).

## Elementos interpretados sin información visual suficiente
Parte posterior (paneles, LED trasero, rejilla), tornillos, sensor secundario y geometría interior del despiece (no modelada).

## Iteración 5 — silueta, visor, franjas y remaches

Comparado lado a lado con la ficha (5 vistas):

- **Silueta**: cuerpo más esférico (1.92 × 1.78 × 1.90, antes 2.0 × 1.70 × 1.82).
- **Visor**: más pequeño (`visor_width_ratio` 0.735) y deja casco visible entre el marco y las orejas. Superelipse asimétrica: arco elíptico arriba (`n_top` 2.0) y algo más plano abajo (n 2.45). El rostro se escala con el visor (`FS = VA/0.792`).
- **Franjas superiores**: latitudes alrededor de un eje inclinado 15° hacia delante. Bajan junto al borde superior del visor y suben hacia atrás por el lateral derecho, como en la vista lateral de la ficha. Cada franja está dividida en 3 segmentos por juntas, con borde azul noche. El acento izquierdo tiene la misma inclinación.
- **Remaches**: 46 instancias de una malla compartida (`SCREW_SOURCE`), situadas:
  - alrededor de cada oreja;
  - en una corona en la base de la antena;
  - en columnas entre el visor y las orejas;
  - en la línea del cinturón, la placa superior y las juntas traseras;
  - en los extremos de las franjas.
- **Cinturón oscuro** más ancho (T2 2.37 → 2.29) y LED frontal subido (z −0.50).
- **Cámaras**: `CAM_FRONT_3Q` pasa al lado derecho (+X), como en la ficha. `CAM_HERO` queda casi frontal, desde la derecha.

Validación: 188 mallas, 28 materiales, 10 expresiones, 8 controladores, 0 problemas, 0 drivers inválidos. `.blend`, `.glb` y renders regenerados.

## Iteración 6 — remaches discretos y reflejo curvo del visor

- **Remaches**: nuevo `MAT_RIVET` (#A79C8C, beige-gris cercano al casco) en lugar del gris oscuro. Cabeza más pequeña (r 0.016) y baja (0.0095).
- **Reflejo del visor**: `VISOR_REFLECTION` es una banda en media luna arriba a la izquierda que sigue el borde del visor, más un brillo corto `VISOR_REFLECTION_SMALL`. Usa el material `MAT_VISOR_REFLECTION`: emisión blanca mezclada con transparencia, con opacidad máxima en el centro de la banda y más fina en las puntas. Va en geometría sobre el cristal, así que también se ve en el GLB. La luz `LIGHT_VISOR_HIGHLIGHT` baja de 70 a 12 W y ya no produce la mancha elíptica.

Validación: 190 mallas, 30 materiales, 0 problemas, 0 drivers inválidos. `.blend`, `.glb` y renders regenerados.
