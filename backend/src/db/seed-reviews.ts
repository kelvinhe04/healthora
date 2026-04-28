import { connectDB } from './connection';
import { Product } from './models/Product';
import { Review } from './models/Review';

const NAMES = [
  'Sofia Martinez', 'Diego Hernandez', 'Valentina Garcia', 'Mateo Rodriguez', 'Camila Lopez',
  'Lucas Fernandez', 'Isabella Gonzalez', 'Santiago Perez', 'Luna Sanchez', 'Benjamin Torres',
  'Olivia Diaz', 'Nicolas Ruiz', 'Emma Vargas', 'Daniel Medina', 'Maria Jimenez',
  'Andres Castro', 'Catalina Ortiz', 'Felipe Morales', 'Antonia Romero', 'Joaquin Herrera',
  'Valeria Reyes', 'Emilio Guerrero', 'Natalia Mendoza', 'Adrian Flores', 'Mariana Rios',
  'Carlos Vega', 'Paula Muñoz', 'Rodrigo Salinas', 'Lucia Aguilar', 'Miguel Castillo',
  'Ana Fuentes', 'Cristian Navarro', 'Fernanda Paredes', 'Eduardo Ibarra', 'Renata Cervantes',
  'Jorge Espinoza', 'Gabriela Montoya', 'Ivan Sandoval', 'Daniela Ponce', 'Oscar Palma',
  'Camilo Guerrero', 'Paola Serrano', 'Hector Navarro', 'Simona Delgado', 'Alexis Villanueva',
  'Karla Fuentes', 'Braulio Santos', 'Ximena Leal', 'Ramon Ibarra', 'Teresa Acosta',
];

type ReviewTemplate = { title?: string; body: string; rating: number };

const REVIEW_POOLS: Record<string, ReviewTemplate[]> = {
  Vitaminas: [
    { title: 'Excelentes resultados', body: 'Llevo tres meses tomándolas y noto una diferencia real en mi energía diaria. Las recomiendo a todos los que tienen deficiencia.', rating: 5 },
    { body: 'Buen suplemento, se absorbe bien y no me deja mal sabor en la boca. El precio es justo por la cantidad que trae.', rating: 4 },
    { title: 'Cumple su función', body: 'Mi médico me las recomendó y la verdad sí noto que me enfermo menos durante el invierno. Ya van dos temporadas tomándolas.', rating: 5 },
    { body: 'Producto de buena calidad. La cápsula es fácil de tragar y no me cae pesada en el estómago, incluso en ayunas.', rating: 4 },
    { title: 'Muy buenas vitaminas', body: 'Ya es la tercera vez que las compro. Son fáciles de tragar y funcionan bien como parte de mi rutina diaria de salud.', rating: 5 },
    { body: 'Buena marca, confiable. He probado otras y estas me gustan más por su fórmula completa y la dosis bien calculada.', rating: 4 },
    { title: 'Relación calidad-precio', body: 'El producto cumple con lo prometido aunque el precio ha subido un poco últimamente. De todas formas son las mejores que he probado.', rating: 3 },
    { body: 'Me las recomendó mi nutrióloga y he notado mejoras en mis uñas, en mi cabello y en mi estado de ánimo general.', rating: 5 },
    { body: 'Las tomo en el desayuno y no me caen mal al estómago a diferencia de otras marcas. Muy buena tolerancia digestiva.', rating: 4 },
    { title: 'Efectivas de verdad', body: 'Noté la diferencia en dos semanas. Más energía por las mañanas y menos cansancio después del trabajo. Las recomiendo.', rating: 5 },
    { body: 'El envase es práctico y bien sellado. Las cápsulas no tienen olor fuerte y se conservan bien.', rating: 4 },
    { title: 'Las mejores del mercado', body: 'Probé varias marcas y ninguna me dio los mismos resultados. Con estas mis análisis de sangre mejoraron notablemente.', rating: 5 },
  ],
  Suplementos: [
    { title: 'Gran suplemento para recuperación', body: 'Llevo usándolo dos meses y los resultados se notan. Me ayuda bastante con la recuperación después de sesiones intensas de ejercicio.', rating: 5 },
    { body: 'Buena fórmula, sin sabores artificiales extraños. Se disuelve bien en agua fría o en el batido de proteína sin dejar grumos.', rating: 4 },
    { title: 'Muy recomendable', body: 'He probado varios del mercado y este es de los mejores por su calidad y precio. Volvería a comprarlo sin dudarlo.', rating: 5 },
    { body: 'Cumple con lo que promete. No tengo quejas, aunque me gustaría que viniera disponible en presentación más grande.', rating: 4 },
    { title: 'Funciona bien', body: 'Lo empecé a tomar por recomendación del entrenador del gimnasio y definitivamente noto más energía en los entrenamientos pesados.', rating: 4 },
    { body: 'Buena calidad. El polvo se mezcla sin grumos y el sabor es tolerable, no es demasiado dulce ni artificial.', rating: 4 },
    { title: 'Excelente para la recuperación muscular', body: 'Lo tomo después de cada entrenamiento fuerte y el músculo no me duele tanto al día siguiente. La diferencia es notable.', rating: 5 },
    { body: 'Muy buena relación precio-calidad. Lo recomiendo a cualquier persona activa que quiera optimizar su rendimiento y recuperación.', rating: 4 },
    { title: 'Bien aunque mejorable', body: 'El producto es bueno pero el envase podría ser más práctico para medir la dosis. El contenido es de excelente calidad.', rating: 3 },
    { body: 'Mi nutricionista deportivo lo recomendó y la verdad ha marcado diferencia en mi rendimiento y en la composición corporal.', rating: 5 },
  ],
  'Salud de la piel': [
    { title: 'Transformó mi piel por completo', body: 'Después de dos semanas mi acné mejoró notablemente. Es el mejor producto que he probado para piel grasa con tendencia acneica.', rating: 5 },
    { body: 'Muy buen producto, no irrita y se nota que funciona desde las primeras aplicaciones. Lo uso en las noches y mi piel está más pareja.', rating: 5 },
    { title: 'Efectivo y sin irritación', body: 'Probé otros tratamientos para el acné y ninguno dio resultados tan rápidos sin irritar ni resecar la piel como este.', rating: 5 },
    { body: 'Buenos resultados en general. Al principio sentí un poco de resequedad pero después la piel se adaptó y el resultado es excelente.', rating: 4 },
    { title: 'Lo recomiendo ampliamente', body: 'Tengo piel sensible y este producto no me causó ninguna reacción adversa. Mis poros lucen más limpios y la piel más uniforme.', rating: 4 },
    { body: 'Funciona tal como lo describe el empaque. Me ha ayudado con los puntos negros y la textura irregular de mi piel.', rating: 4 },
    { title: 'Resultado notable en semanas', body: 'Esperaba meses para ver cambios pero en menos de 10 días mis manchas oscuras empezaron a aclararse de manera visible.', rating: 5 },
    { body: 'Buen producto aunque hay que ser paciente. Los resultados no son inmediatos pero sí se ven con uso constante y disciplinado.', rating: 3 },
    { body: 'Excelente textura, no se siente grasoso y se absorbe rápidamente. Ideal para usar como paso previo al maquillaje.', rating: 5 },
    { title: 'El mejor ácido que he probado', body: 'Lo uso tres veces por semana y mi piel está completamente diferente. Las manchas han aclarado y los poros lucen más pequeños.', rating: 5 },
  ],
  Hidratantes: [
    { title: 'La mejor crema que he probado', body: 'Mi piel estaba muy reseca y desde que uso esta crema está completamente hidratada todo el día. No se siente pegajosa ni pesada.', rating: 5 },
    { body: 'Muy buena hidratación sin sensación grasosa. Se absorbe rápido y el aroma es suave y agradable, perfecto para uso diario.', rating: 5 },
    { title: 'Perfecta para piel sensible', body: 'Tengo piel sensible y esta crema no me causa ninguna reacción. Es suave, efectiva y un envase me dura bastante tiempo.', rating: 5 },
    { body: 'Buena crema, aunque para piel muy seca recomendaría aplicar dos capas. Para pieles normales a secas es perfecta tal como viene.', rating: 4 },
    { title: 'Excelente relación calidad-precio', body: 'Un envase dura bastante tiempo y el resultado es visible desde la primera semana. Piel notablemente más suave y luminosa.', rating: 4 },
    { body: 'Me la recomendó la dermatóloga y no me ha decepcionado en absoluto. Ya compré mi segundo envase sin dudar.', rating: 5 },
    { title: 'Muy hidratante y ligera', body: 'La textura es ligera pero muy nutritiva. La uso mañana y noche y mi piel está suave e hidratada en todo momento.', rating: 5 },
    { body: 'Buena crema aunque el envase es un poco incómodo cuando casi se acaba. El producto en sí es de muy buena calidad.', rating: 4 },
    { title: 'Funciona de verdad', body: 'Probé muchas cremas para la resequedad y ninguna funcionó como esta. La recomiendo ampliamente a todo tipo de piel.', rating: 5 },
    { body: 'Aroma suave y textura ligera. No tapa los poros y deja la piel con un acabado mate natural muy agradable.', rating: 4 },
    { title: 'Piel increíblemente suave', body: 'Mi pareja notó el cambio en mi piel antes de que yo lo hiciera. Esta crema realmente transforma la textura de la piel.', rating: 5 },
  ],
  Fitness: [
    { title: 'Excelente proteína', body: 'La mejor que he probado en cuanto a sabor y solubilidad. Me ayuda a alcanzar mis metas de proteína diaria sin problemas.', rating: 5 },
    { body: 'Se mezcla bien, sin grumos, y el sabor es muy bueno. No deja esa sensación de sed que dan otras marcas después de tomarla.', rating: 5 },
    { title: 'Muy buena calidad', body: 'Llevo seis meses usándola y mis resultados en el gym han mejorado bastante. La recuperación entre sesiones es más rápida.', rating: 5 },
    { body: 'Buena relación precio-cantidad. Para el día a día está perfecto, aunque para competidores quizás necesiten algo más especializado.', rating: 4 },
    { title: 'Cumple lo que promete', body: 'No es mágica pero si entrenas bien y la tomas con constancia los resultados se ven claramente. Muy recomendada para todos.', rating: 4 },
    { body: 'El sabor chocolate es delicioso. Se mezcla fácil en agua y queda cremoso sin grumos. Ya es parte imprescindible de mi rutina.', rating: 5 },
    { title: 'Buen pre-entreno sin nerviosismo', body: 'Me da la energía que necesito para entrenar duro sin hacerme sentir ansioso ni con la presión alterada. Lo tomo 20 min antes.', rating: 4 },
    { body: 'Gran producto para la recuperación muscular. Lo combino con mi batido de proteína y los resultados en fuerza son notables.', rating: 4 },
    { title: 'Perfecto para etapa de volumen', body: 'Estoy en etapa de volumen y este producto ha sido clave para llegar a mi ingesta calórica sin sentirme hinchado.', rating: 5 },
    { body: 'Buena proteína, sin sabores artificiales fuertes. Me gusta que la lista de ingredientes sea limpia y sin rellenos innecesarios.', rating: 4 },
    { title: 'Mis BCAAs favoritos', body: 'Excelente para mantenerse anabólico durante el entrenamiento. El sabor no es empalagoso y se mezcla perfecto.', rating: 5 },
  ],
  Medicamentos: [
    { title: 'Funciona muy rápido', body: 'Lo tomé para el dolor de cabeza y en 30 minutos ya no sentía nada. Es mi analgésico de confianza para emergencias.', rating: 5 },
    { body: 'Efectivo para el dolor muscular después de entrenar. No me da malestar estomacal como me pasa con otros medicamentos.', rating: 4 },
    { title: 'Siempre en mi botiquín', body: 'Es el medicamento que nunca falta en mi casa. Rápido, efectivo y bien tolerado tanto por adultos como por los niños mayores.', rating: 5 },
    { body: 'Buena presentación y dosis adecuada. Hace efecto en tiempo razonable sin efectos secundarios molestos o somnolencia.', rating: 4 },
    { title: 'Confiable y efectivo', body: 'Lo he usado varias veces para diferentes tipos de dolor y siempre hace efecto sin fallar. Totalmente recomendado.', rating: 5 },
    { body: 'Funciona bien aunque para dolores muy intensos prefiero la versión de dosis mayor. Para dolores moderados es perfecto.', rating: 3 },
    { title: 'Alivio rápido y duradero', body: 'Para cuando tienes un dolor repentino en el trabajo o durante la noche es ideal. El alivio es rápido y dura varias horas.', rating: 5 },
    { body: 'Producto de calidad, precio accesible y siempre disponible en la tienda. Muy buena compra para tener en casa.', rating: 4 },
    { title: 'El mejor para la gripe', body: 'Lo tomo a la primera señal de gripe y la recuperación es mucho más rápida. Los síntomas se alivian notablemente.', rating: 5 },
  ],
  'Cuidado personal': [
    { title: 'Aroma increíble todo el día', body: 'Desde que uso este jabón mi piel huele muy bien durante horas. La espuma es abundante y deja la piel suave e hidratada.', rating: 5 },
    { body: 'Muy buen producto, hidrata sin dejar sensación grasosa. El dispensador es práctico y no desperdicia nada del producto.', rating: 4 },
    { title: 'No lo cambiaría por nada', body: 'Ya lo uso desde hace dos años y mi piel nunca ha estado tan bien. El aroma es sutil pero dura muchas horas.', rating: 5 },
    { body: 'Buena calidad y rinde bastante. Me gusta que no contiene ingredientes agresivos ni parabenos para la piel sensible.', rating: 4 },
    { title: 'Desodorante que realmente funciona', body: 'Por fin encontré un desodorante que realmente funciona todo el día sin manchar la ropa. Una aplicación y listo para el día.', rating: 5 },
    { body: 'Buen producto de uso diario. No irrita incluso si se usa justo después de afeitarse. Muy recomendable para pieles sensibles.', rating: 4 },
    { title: 'Perfecto para piel sensible', body: 'Tengo piel sensible que reacciona a casi todo y este producto no me causa absolutamente ninguna reacción. Excelente.', rating: 5 },
    { body: 'Muy buena fórmula, sin alcohol ni parabenos. Se nota la diferencia en la suavidad y tono de la piel con el uso regular.', rating: 4 },
    { title: 'Gran compra inteligente', body: 'Rinde mucho y el precio es muy razonable. La textura cremosa se siente muy bien y el olor es agradable sin ser fuerte.', rating: 4 },
    { body: 'El aroma es suave y agradable, no es abrumador como el de otras marcas. Ideal para personas sensibles a los perfumes.', rating: 4 },
  ],
  'Cuidado del bebé': [
    { title: 'Suave para la piel más delicada', body: 'Mi bebé tiene la piel muy sensible y este producto no le causa ninguna irritación. Lo uso con total confianza y tranquilidad.', rating: 5 },
    { body: 'Excelente producto para el área del pañal. La dermatitis de mi niña desapareció en dos días de uso. Muy recomendado por pediatras.', rating: 5 },
    { title: 'El mejor para bebés con piel sensible', body: 'Lo usan en la clínica pediátrica donde me atendieron. Me lo recomendaron las enfermeras y no decepciona para nada.', rating: 5 },
    { body: 'Buena loción, sin fragancia fuerte ni ingredientes irritantes. La absorción es rápida y deja la piel del bebé suave.', rating: 4 },
    { title: 'Apto desde recién nacido', body: 'Apto para recién nacidos. He probado varios productos y este es el que mejor tolera mi bebé. La pediatra también lo aprueba.', rating: 5 },
    { body: 'Buen producto aunque el precio podría ser mejor. La calidad es innegable y el bebé no llora ni se incomoda al aplicarlo.', rating: 4 },
    { title: 'Confiable y seguro para toda la familia', body: 'Sin ingredientes dañinos ni fragancias artificiales. Lo he usado desde que nació mi hijo y su piel siempre está perfecta.', rating: 5 },
    { body: 'Muy buena absorción de humedad. Las fugas son casi inexistentes durante la noche y el bebé no tiene sarpullido.', rating: 5 },
    { title: 'Me lo recomendó la pediatra', body: 'La doctora lo recetó específicamente para el eccema de mi bebé y en una semana mejoró muchísimo. Excelente producto.', rating: 5 },
  ],
  Fragancias: [
    { title: 'Un perfume absolutamente increíble', body: 'La proyección y la duración son extraordinarias. Recibo comentarios positivos todo el día. Totalmente enamorada de esta fragancia.', rating: 5 },
    { body: 'Aroma sofisticado y elegante. La botella es preciosa y la fragancia permanece en la piel muchas horas con buena proyección.', rating: 5 },
    { title: 'Mi nuevo perfume favorito', body: 'Lo compré por curiosidad y ya no puedo vivir sin él. La combinación de notas florales y almizcladas es perfecta para el día a día.', rating: 5 },
    { body: 'Muy buen perfume aunque al principio las notas de salida son muy intensas. Una vez que se asientan queda absolutamente precioso.', rating: 4 },
    { title: 'Elegante y de larga duración', body: 'Para una ocasión especial o para el trabajo es perfecto. No es invasivo pero sí se percibe de manera agradable. Lo recomiendo.', rating: 4 },
    { body: 'El olor es tal como lo describen. Las notas base son muy buenas y la duración en la ropa es de varios días. Impresionante.', rating: 5 },
    { title: 'El regalo perfecto', body: 'Lo compré como regalo de cumpleaños y fue todo un éxito. La presentación del estuche es lujosa y el perfume es exquisito.', rating: 5 },
    { body: 'Buena fragancia, aunque hay versiones más económicas con aroma similar. Pero la calidad y la duración de este son inigualables.', rating: 4 },
    { title: 'Duración excepcional', body: 'Me lo pongo a las 7 de la mañana y al mediodía todavía huele increíble con buena proyección. Muy buena duración.', rating: 5 },
    { body: 'Me enamoré del aroma al probarlo en la tienda y lo compré ese mismo día sin pensarlo. No me arrepiento para nada.', rating: 5 },
    { title: 'Único y especial', body: 'Es difícil encontrar un perfume tan original y sofisticado. Este se convirtió en mi fragancia signature y ya todos me lo identifican.', rating: 5 },
  ],
  Maquillaje: [
    { title: 'Cobertura absolutamente increíble', body: 'Cubre todo lo que necesito sin sentirse pesado en la piel. La fórmula es hermosa y la base dura perfecta todo el día sin retoque.', rating: 5 },
    { body: 'Excelente delineador, no se corre ni con calor ni con humedad intensa. El resultado es muy profesional y de larga duración.', rating: 5 },
    { title: 'La mejor base que he usado', body: 'El acabado es natural pero con cobertura media alta. Se difumina facilísimo y dura hasta 10 horas sin retoque ni oxidarse.', rating: 5 },
    { body: 'Muy buen rímel, no se cae en pelotitas ni me deja manchas negras bajo los ojos durante el día. El cepillo es perfecto.', rating: 5 },
    { title: 'No la cambio por nada en el mundo', body: 'Llevo tres años usando esta base y no la cambiaría. La textura y cobertura mejoran con el tiempo y el FPS es un plus genial.', rating: 5 },
    { body: 'Buena cobertura aunque para pieles muy grasas puede necesitar sellarse con polvo translúcido. El color es precioso y natural.', rating: 4 },
    { title: 'Color hermoso y natural', body: 'El color es exactamente como en la foto de la página. Se ve natural y es fácil de difuminar con las yemas de los dedos.', rating: 5 },
    { body: 'Labial súper hidratante y con buen color. No reseca los labios para nada y dura bastante tiempo sin necesitar retoque.', rating: 4 },
    { title: 'El mejor corrector del mercado', body: 'Probé muchos correctores y este es el único que realmente cubre mis ojeras sin acumularse en líneas de expresión.', rating: 5 },
    { body: 'Iluminador precioso que da un glow muy natural. Queda perfecto tanto en el arco del labio como en los pómulos y cupido.', rating: 5 },
    { title: 'Indispensable en mi rutina', body: 'Ya no salgo de casa sin este producto. La diferencia entre usarlo y no usarlo es enorme. Mi piel luce increíble con él.', rating: 5 },
  ],
};

const DEFAULT_POOL: ReviewTemplate[] = [
  { title: 'Muy buen producto', body: 'Cumple perfectamente con lo que promete. La calidad es excelente y el precio es muy justo por lo que ofrece.', rating: 5 },
  { body: 'Buen producto en general. La entrega fue rápida y el empaque llegó en perfecto estado, sin ningún daño.', rating: 4 },
  { title: 'Recomendado al 100%', body: 'Lo compré por recomendación de un amigo y no me arrepiento. Funciona muy bien y tiene excelente relación precio-calidad.', rating: 5 },
  { body: 'Producto de calidad, se nota que es una buena marca con ingredientes de primer nivel. Lo volvería a comprar sin duda.', rating: 4 },
  { title: 'Excelente compra', body: 'Superó mis expectativas completamente. La calidad es notablemente mejor que productos similares de otras marcas del mercado.', rating: 5 },
  { body: 'Buena opción para el precio que tiene. Hace exactamente lo que promete y la presentación del empaque es atractiva.', rating: 3 },
  { title: 'Segunda compra, no la última', body: 'Segunda vez que lo compro. La consistencia en la calidad es lo que más valoro de esta marca. Siempre cumple.', rating: 4 },
  { body: 'Excelente producto, llegó bien empacado y en el tiempo prometido. Definitivamente lo recomendaría a familiares y amigos.', rating: 5 },
  { title: 'Muy satisfecho con la compra', body: 'No esperaba tan buen resultado honestamente. Me sorprendió gratamente y lo he recomendado a varias personas ya.', rating: 5 },
  { body: 'Producto confiable de una marca reconocida. No es el más económico pero la calidad justifica completamente el precio.', rating: 4 },
];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice<T>(arr: T[]): T {
  return arr[randomInt(0, arr.length - 1)];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randomDate(daysBack = 180): Date {
  const d = new Date();
  d.setDate(d.getDate() - randomInt(1, daysBack));
  d.setHours(randomInt(8, 22), randomInt(0, 59), randomInt(0, 59));
  return d;
}

async function seedReviews() {
  await connectDB();

  await Review.deleteMany({ userId: /^seed_user_/ });

  const products = await Product.find({}, 'id category').lean();
  const shuffled = shuffle(products);
  const selectedProducts = shuffled.slice(0, Math.floor(shuffled.length * 0.75));

  const reviews: object[] = [];
  let userCounter = 1;

  for (const product of selectedProducts) {
    const pool = REVIEW_POOLS[product.category as string] ?? DEFAULT_POOL;
    const reviewCount = randomInt(2, 7);
    const shuffledPool = shuffle(pool);
    const usedNames = new Set<string>();

    for (let i = 0; i < reviewCount; i++) {
      const template = shuffledPool[i % shuffledPool.length];

      let userName: string;
      let attempts = 0;
      do {
        userName = randomChoice(NAMES);
        attempts++;
      } while (usedNames.has(userName) && attempts < 20);
      usedNames.add(userName);

      const createdAt = randomDate(180);

      const voterCount = Math.random() < 0.4 ? 0 : randomInt(1, 14);
      const helpfulVoters = Array.from(
        { length: voterCount },
        (_, vi) => `seed_voter_${String(userCounter * 20 + vi + 1).padStart(6, '0')}`
      );

      reviews.push({
        productId: product.id,
        userId: `seed_user_${String(userCounter++).padStart(4, '0')}`,
        userName,
        rating: template.rating,
        title: template.title,
        body: template.body,
        helpfulVoters,
        createdAt,
        updatedAt: createdAt,
      });
    }
  }

  await Review.insertMany(reviews);
  console.log(`✓ ${reviews.length} reseñas insertadas en ${selectedProducts.length} de ${products.length} productos`);
  process.exit(0);
}

seedReviews().catch((e) => {
  console.error(e);
  process.exit(1);
});
