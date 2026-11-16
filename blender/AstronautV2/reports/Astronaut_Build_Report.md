# Astronauta Mensajero V2 — Informe de construcción

## 1. Entorno
- **Blender:** 5.2.3 LTS (Python 3.14.9). El prompt pedía Blender 4.x; los sockets se consultan por nombre y los enums se asignan con `try/except`, así que los scripts funcionan en 5.x.
- **Herramientas MCP usadas** (servidor `blender`): `execute_blender_code`, `look` y `get_scene_info`.
- **Motor de render:** EEVEE (128 muestras), transformación de vista *Khronos PBR Neutral* y bloom en el compositor.
  - No se usó Cycles.

## 2. Entregables
| Archivo | Ruta |
|---|---|
| Archivo principal | `blender/AstronautV2/CosmicMail_Astronaut_Final.blend` |
| GLB (malla + rig + acciones) | `blender/AstronautV2/CosmicMail_Astronaut.glb` (8,6 MB) |
| FBX | `blender/AstronautV2/CosmicMail_Astronaut.fbx` (14,4 MB) |
| Checkpoints | `checkpoints/Astronaut_01_Blockout.blend`, `Astronaut_08_Rig.blend`, `Astronaut_09_Validated.blend` |
| Validación | `reports/validation.json` |
| Comparación con la ficha | `reports/Astronaut_vs_Reference.png` (arriba la ficha, abajo los renders) |
| Referencia | `reference/astronaut_reference.png` (1448×1086) |

**Checkpoints:** las fases 02–07 no se guardaron por separado. Todos los scripts son idempotentes, así que cualquier fase se reconstruye ejecutando su script.

## 3. Cifras (validation.json)
| Concepto | Valor |
|---|---|
| Objetos | 310 |
| Mallas | 264 |
| Vértices / caras | 274.839 / 281.369 |
| Materiales en uso | 14 |
| Huesos | 40 (5 dedos × 2 falanges por mano) |
| Cámaras | 11 |
| Luces | 7 |
| Drivers | 4, todos válidos (indicadores de la mochila y 3 tarjetas de reflejo) |
| Caras degeneradas | 0 |
| Problemas | 0 |

## 4. Scripts (`scripts/`, en orden de ejecución)

### Utilidades y ejecución
- `config.py`, `geometry_utils.py`, `material_utils.py` y `rig_utils.py`.
- `run.py` ejecuta cada etapa con `run_stage("NN_x")` desde el MCP.

### Etapas de construcción
| Etapa | Contenido |
|---|---|
| `00_initialize` | Escena limpia y colecciones. Se detiene si el archivo abierto tiene cambios sin guardar. |
| `01_blockout` | Volúmenes de prueba. Se usaron para corregir proporciones y luego se eliminaron. |
| `02_helmet` | Paneles con juntas reales sobre un núcleo oscuro, franjas, módulos y cuello. |
| `03_visor` | Cristal negro reflectante sin HUD (superelipse convexa), sello, filo cálido y marco crema. |
| `04_torso` | Pelvis, cintura y tronco acolchados, unidad pectoral, arnés, hebillas y costuras. |
| `05_arms` | Hombros en bloque acolchado con placa naranja rectangular apoyada encima, mangas, codo de fuelle y antebrazo con panel gris. |
| `06_gloves` | Guantelete crema con borde oscuro y parche naranja, dorso crema con costura en V, cinco dedos de dos falanges; pulgar e índice hacia delante. |
| `07_legs` | Cadera, muslo, rodilla con fuelle, banda y refuerzos naranjas delante y detrás, y espinilla. |
| `08_boots` | Cuerpo por secciones, puntera, talonera, suela con borde y 25 tacos instanciados por bota, caña y hebilla. |
| `09_backpack` | Carcasa, asa superior, panel trasero modular (placa superior, barra, placa inferior con tornillo, ranura), pestañas grises, rieles, botón lateral, dos luces naranjas por lado, zócalo, conductos corrugados en lazo, conectores y anclajes. |
| `10_details` | Costuras que siguen el relieve acolchado. |
| `11_materials` | Materiales PBR con microtexturas procedurales; retira cualquier resto del antiguo HUD. |
| `13_rig` | Armature, IK, emparentado y propiedades. |
| `14_animation` | Pose de referencia y animación de prueba. |
| `15_studio` | Fondo, luces, tarjetas de reflejo, *light linking* (las luces de relleno no se reflejan en el visor), cámaras y compositor. |
| `16_validation` | Validación geométrica y del rig. |
| `16b_renders` | Renders finales. |
| `17_export` | GLB, FBX y verificación del GLB. |

`16b_renders.py` no estaba en la estructura del prompt: separa los renders en lotes para que ninguna llamada MCP tarde demasiado.

## 5. Validaciones completadas
### Geometría
- 0 mallas vacías.
- 0 caras degeneradas.
- 0 objetos sin material.
- 0 escalas negativas.
- 0 nombres genéricos.
- 0 objetos fuera de colección.
- 0 normales invertidas en las mallas cerradas (volumen firmado).
- Superficies abiertas, todas intencionadas: paneles del casco, franjas, visor, puntera, talonera, sellos y caras sueltas del suelo del estudio. Ninguna queda pendiente de revisión.

### Rig (`rig_tests`, todas superadas)
- Al girar la cabeza, el visor se mantiene rígido (desviación < 0,1 mm).
- La mochila y los conductos siguen al torso.
- El codo flexiona hasta 87,7° y la muñeca sigue al IK y rota.
- La rodilla flexiona hasta 91,1°.
- Los dedos se doblan.
- No queda ningún objeto HUD en la escena (`no_hud_objects`).

### IK
- Los ángulos de polo se calcularon automáticamente para que las cadenas conserven la pose de reposo. El error residual es de 0,0079 en los brazos y 0,0035 en las piernas.
- En el fotograma 1, el error máximo por hueso frente al reposo es 0,005.

### GLB reimportado en una escena temporal
- Altura 3,02 con la base en z = 0, la orientación correcta (el casco es algo más alto tras la revisión 2).
- 279 piezas, 1 armature, 13 materiales y 5 acciones.
- El importador crea además una esfera auxiliar para mostrar los huesos; se excluyó de la medición.

## 6. Renders generados (`renders/`, 1600 px)
- `Astronaut_Front`, `ThreeQuarter`, `Left`, `Right`, `Rear` y `Rear_ThreeQuarter`.
- Primeros planos: `Helmet_Closeup`, `Backpack_Closeup`, `Gloves_Closeup` y `Boots_Closeup`.
- `Astronaut_Hero`.

## 7. Rig y controles
### Huesos (`ASTRONAUT_RIG`)
- Cuerpo: ROOT › PELVIS › SPINE_01 › SPINE_02 › NECK › HEAD.
- Por lado: CLAVICLE › UPPER_ARM › FOREARM › HAND › {THUMB, INDEX, MIDDLE, RING, PINKY}_01/_02.
- Piernas: THIGH › SHIN › FOOT.

### Controladores
- IK: `CTRL_HAND_L/R_IK` y `CTRL_FOOT_L/R_IK`, con polos `CTRL_ELBOW_*_POLE` y `CTRL_KNEE_*_POLE`.
- Mano y pie siguen a su controlador mediante *Child Of*.

### Piezas
- Las piezas rígidas (casco, visor, mochila, unidad pectoral, hebillas…) están emparentadas a su hueso y no se deforman.
- El traje es geometría segmentada: cada tramo acolchado pertenece a un hueso, y los fuelles oscuros de codo y rodilla cubren la articulación.
- No hay pesos de vértices.

### Propiedades conectadas
- `ASTRONAUT_RIG`:
  - `visor_reflection_strength` controla la energía de las tres tarjetas de reflejo.
  - `backpack_light_intensity` controla la emisión de los indicadores de la mochila.

### Animación
- `POSE_REFERENCE_NEUTRAL`: acción con usuario falso.
- Prueba de 120 fotogramas a 24 fps:
  - cabeza y torso;
  - saludo con IK del brazo izquierdo;
  - balanceo del brazo derecho;
  - apertura y cierre de dedos;
  - elevación del pie derecho con flexión de rodilla y rotación de tobillo.

## 8. Errores encontrados y correcciones
1. **Proporciones del blockout.** La comparación con la ficha mostró brazos, piernas, torso y botas demasiado finos. Se ajustaron los radios a las medidas de la vista frontal: brazo 0,17, muslo 0,245, torso 0,50 y bota 0,52 × 0,64.
2. **Visor.** Era pequeño, se agrandó hasta ocupar casi todo el frente (semieje 0,468). El marco se adelgazó para no salirse del casco.
3. **Guantes.** Eran demasiado pequeños frente al antebrazo; se escalaron ×1,4.
4. **Base de la mano.** La base no era ortonormal directa; se corrigió, junto con el signo de flexión para que los dedos cierren hacia la palma.
5. **Reposo de la animación.** Tomaba la pose de prueba como reposo de los controladores IK. Ahora el reposo sale de `config.py`.
6. **Drivers inválidos tras reconstruir el rig.** Las emisiones salían a 0. Se añadió `refresh_drivers()` en el rig, la animación, la validación, los renders y la exportación.
7. **Errores del script de exportación.**
   - Fallaba con `vertices[::50]`, que no está soportado. Se cambió a `range(..., 50)` y se añadió `try/finally` para restaurar siempre la escena.
   - La altura medida incluía la esfera auxiliar del importador; se excluyó.
8. **Mejoras visuales tras comparar con la ficha.**
   - Conductos de la mochila desplazados por detrás del brazo.
   - Mochila más alta.
   - Hombros más grandes, con el panel naranja cubriendo la parte superior y la cara exterior.
   - Franjas laterales del casco en diagonal hacia el módulo.
   - Sellos de cintura en tejido en vez de azul.

## 8b. Revisión 2 (correcciones del usuario)
| Petición | Cambio |
|---|---|
| Sin emociones en el visor | Eliminados `12_expressions`, `CTRL_HUD`, `MAT_HUD_AMBER`, sus drivers, la acción `ASTRO_TestAnim_HUD`, las pruebas y la hoja de render. Se descubrió que los reflejos de las luces de relleno y de las tarjetas formaban "ojos y boca"; se recolocaron las tarjetas (un brillo cuadrado arriba-derecha, un destello en el borde izquierdo, tinte ámbar difuso abajo) y se excluyó el cristal de las luces de relleno con *light linking*. |
| Hombros demasiado circulares | El elipsoide pasa a un bloque superelíptico (n 3,4) inclinado 16° hacia fuera, con dos costuras acolchadas y una placa naranja rectangular proyectada sobre su cara superior. |
| Manos al revés | El eje de nudillos apuntaba hacia delante, así que índice y pulgar quedaban detrás. Ahora índice y pulgar van hacia delante (−Y), meñique detrás, palma hacia el muslo y dorso hacia fuera. Se añadió guantelete crema, parche naranja rectangular, costura en V tipo sobre y ligera apertura de dedos. |
| Visor más chico (como la guía) | Semiejes 0,468×0,362 → 0,425×0,345 y exponente 2,45 → 2,25 (más ovalado); el marco crema queda visible alrededor. Casco algo más alto (rz 0,515 → 0,54). |
| Orejas | Radio 0,215, carcasa gris satinada, filo naranja en la cara exterior (como la ficha), anillo gris, disco claro abombado y botón central. Gris técnico menos cromado (metálico 0,25, rugosidad 0,46). |
| Soporte vital | Asa superior más robusta, placa inferior con tornillo, pestañas grises en los bordes, botón cuadrado lateral, segunda luz naranja por lado, zócalo lateral y conductos más gruesos (r 0,06) en lazo hacia fuera y delante. |
| Fallo detectado | Las tarjetas de reflejo habían quedado con energía 0 (el rig leía la energía base de la luz cuando el driver ya la había puesto a 0). Ahora la energía base es fija en `13_rig`. |

## 9. Interpretaciones geométricas
- **Franjas laterales del casco:** solo en el lado +X (izquierda del personaje), como en las vistas frontal, tres cuartos y lateral de la ficha. La franja central sagital va desde encima del visor hasta la nuca.
- **Refuerzos naranjas de rodilla:** delante y detrás, porque la vista trasera también los muestra.
- **Disco pectoral:** se usa el azul vivo de la ficha (`MAT_CHEST_BLUE` #1F4FA8), que no pertenece a la paleta obligatoria. Afecta solo a ese componente. Si se prefiere #26354A, basta con cambiar una línea en `material_utils.py`.
- **Conductos:** forman un lazo en cada lado de la mochila, de arriba-delante a abajo, con conectores grises en los extremos. La ficha no muestra dónde entran exactamente en el traje.
- **Reflejos del visor:** se generan con tres tarjetas de área cálidas que solo afectan al brillo especular. No están pintados en el visor.
- **Visor sin emociones:** por decisión del usuario el visor no muestra expresiones; es un cristal negro con reflejos. Las tarjetas de reflejo se colocaron para que no formen nada parecido a una cara.

## 10. Control de calidad (estimación propia tras comparar renders)
| Categoría | Peso | Nota |
|---|---:|---:|
| Silueta y proporciones | 20 % | 8 |
| Casco y visor | 20 % | 7,5 |
| Torso y arnés | 10 % | 8 |
| Brazos y guantes | 10 % | 7,5 |
| Piernas y botas | 10 % | 7,5 |
| Mochila | 15 % | 7,5 |
| Materiales | 5 % | 8 |
| Rig y calidad geométrica | 5 % | 9 |
| **Total ponderado** | | **≈ 7,8 / 10** |

**No se alcanza el objetivo de 9/10.** Diferencias principales que quedan:
- **Visor:** en la ficha es ámbar translúcido con grandes reflejos rectangulares. En el modelo es más negro y los reflejos son menores.
- **Traje:** en la ficha es más beige y cálido, con más acolchado vertical y más tiras del arnés (diagonales y laterales). El modelo muestra sobre todo surcos horizontales.
- **Hombros:** ya son bloques con placa naranja, pero en la ficha la placa es algo más plana y gruesa. Las botas de la ficha tienen la caña más alta y la puntera más visible de frente.
- **Mochila:** en la ficha asoma por encima de los hombros con esquinas grises visibles de frente; en el modelo asoma menos.
- **Brazos:** en la ficha cuelgan algo más abiertos. Los guantes ya tienen el pulgar delante, pero los dedos de la ficha son más gruesos.
- **Conductos:** asoma un tramo oscuro junto al casco en la vista frontal; en la ficha ahí se ven las esquinas grises de la mochila.

## 11. Limitaciones
- Solo EEVEE; no se probó Cycles.
- El rig usa piezas rígidas segmentadas, sin pesos de vértices.
- Los drivers y las propiedades personalizadas no se transfieren al GLB ni al FBX.

## 12. Estado final
Personaje completo, editable, con rig y animación de prueba, validado sin problemas y exportado. La fidelidad visual es alta en silueta, casco, unidad pectoral y mochila, pero no es una copia exacta de la ficha; las diferencias se detallan en la sección 10.
