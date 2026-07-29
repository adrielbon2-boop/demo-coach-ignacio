// Vercel Function: analiza cada consulta que entra por el formulario,
// le asigna una prioridad y devuelve vistas previas de email/WhatsApp (no se envían).

const BUDGET_SCORE = {
  "mas-10000": 91,
  "2000-10000": 70,
  "500-2000": 44,
  "no-decir": 30,
};

const BUDGET_LABEL = {
  "mas-10000": "busca crecer como líder o ejecutivo/a",
  "2000-10000": "busca escalar su negocio",
  "500-2000": "busca claridad y foco",
  "no-decir": "todavía está explorando qué necesita",
};

const URGENCY_WORDS = ["urgente", "urgencia", "cuanto antes", "lo antes posible", "ya mismo", "hoy mismo", "necesito ya", "esta semana", "al limite", "al límite", "quemado", "burnout"];
const LOW_INTENT_WORDS = ["solo pregunto", "solo averiguando", "curiosidad", "por las dudas", "sin apuro", "informacion general", "información general"];
const HIGH_VALUE_WORDS = ["1 a 1", "1:1", "asesoramiento privado", "mentoria privada", "mentoría privada", "delegar", "armar un equipo", "contratar equipo", "escalar", "no logro escalar", "estancado", "estanque", "tope de facturacion", "tope de facturación"];
const MONEY_PATTERN = /\d[\d.,]{0,7}\s?(k\b|mil\b|usd\b|d[oó]lares|pesos|u\$s)/i;

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function buildEmailPreview({ nombre, priority }) {
  const timeframe = priority === "Alta" ? "dentro de las próximas horas" : priority === "Media" ? "dentro del día de hoy" : "a la brevedad";
  return {
    to: "[email de quien consulta]",
    from: "Ignacio Rojas — Coach <hola@ignaciorojas.com>",
    subject: `Recibí tu mensaje, ${nombre.split(" ")[0]}`,
    body:
      `Hola ${nombre.split(" ")[0]},\n\n` +
      `Gracias por escribirme. Ya recibí tu mensaje y lo estoy revisando.\n\n` +
      `Te voy a responder ${timeframe} para coordinar la sesión estratégica.\n\n` +
      `Mientras tanto, cualquier cosa que quieras agregar sobre tu situación, respondé directamente este correo.\n\n` +
      `Saludos,\nIgnacio`,
  };
}

function buildWhatsappPreview({ nombre, priority }) {
  const timeframe = priority === "Alta" ? "dentro de las próximas horas" : priority === "Media" ? "dentro del día de hoy" : "a la brevedad";
  return {
    text: `Hola ${nombre.split(" ")[0]} 👋 Gracias por escribirme. Ya recibí tu mensaje y te respondo ${timeframe}.`,
  };
}

function scoreLead({ presupuesto, mensaje }) {
  const insights = [];
  let score = BUDGET_SCORE[presupuesto] ?? 35;
  insights.push(`La persona ${BUDGET_LABEL[presupuesto] ?? "no especificó su objetivo"} → base de ${score} puntos.`);

  const text = (mensaje || "").toLowerCase();
  const hasUrgency = URGENCY_WORDS.some((w) => text.includes(w));
  const hasLowIntent = LOW_INTENT_WORDS.some((w) => text.includes(w));
  const hasHighValueLanguage = HIGH_VALUE_WORDS.some((w) => text.includes(w));
  const hasConcreteFigure = MONEY_PATTERN.test(text);

  if (hasUrgency) {
    score += 12;
    insights.push('Detecté lenguaje de urgencia o desgaste ("al límite", "burnout", etc.) (+12).');
  }
  if (hasConcreteFigure && hasHighValueLanguage) {
    score += 18;
    insights.push('El mensaje incluye una cifra de facturación concreta junto con intención explícita de escalar o delegar — señal de alta seriedad (+18).');
  } else if (hasConcreteFigure) {
    score += 10;
    insights.push("Mencionó una cifra concreta de facturación o ingresos — indicador de un negocio real, no una consulta genérica (+10).");
  } else if (hasHighValueLanguage) {
    score += 8;
    insights.push('Usó lenguaje de compromiso ("escalar", "delegar", "asesoramiento privado") — sugiere intención real de avanzar (+8).');
  }
  if (hasLowIntent) {
    score -= 15;
    insights.push('El mensaje suena exploratorio ("solo averiguando", "información general") (-15).');
  }
  if (!hasUrgency && !hasLowIntent && !hasHighValueLanguage && !hasConcreteFigure && mensaje) {
    insights.push("El mensaje no muestra señales claras de urgencia, compromiso o baja intención; se mantiene el puntaje base.");
  }

  score = clamp(Math.round(score), 1, 100);

  let priority, recommendation;
  if (score >= 70) {
    priority = "Alta";
    recommendation = "Contactar dentro de las próximas horas. Alta probabilidad de encajar con el programa 1:1.";
  } else if (score >= 40) {
    priority = "Media";
    recommendation = "Contactar dentro del día y ofrecer la sesión de diagnóstico.";
  } else {
    priority = "Baja";
    recommendation = "Sumar a la lista de seguimiento; no requiere atención inmediata.";
  }

  return { score, priority, insights, recommendation };
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método no permitido" });
    return;
  }

  try {
    const { nombre, email, presupuesto, mensaje } = req.body || {};

    if (!nombre || !email || !presupuesto) {
      res.status(400).json({ error: "Faltan campos obligatorios." });
      return;
    }

    const result = scoreLead({ presupuesto, mensaje });
    const emailPreview = buildEmailPreview({ nombre, priority: result.priority });
    const whatsappPreview = buildWhatsappPreview({ nombre, priority: result.priority });

    res.status(200).json({
      nombre,
      ...result,
      emailPreview,
      whatsappPreview,
    });
  } catch (err) {
    res.status(500).json({ error: "Error interno al procesar la consulta." });
  }
};
