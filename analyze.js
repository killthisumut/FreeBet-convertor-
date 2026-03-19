export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Clé API Gemini manquante. Configurez GEMINI_API_KEY dans les variables d\'environnement Vercel.' });
  }

  const { images } = req.body;
  if (!images || !Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ error: 'Aucune image fournie.' });
  }

  // Build Gemini parts: interleave text labels and images
  const parts = [];

  images.forEach((img, i) => {
    parts.push({
      text: `Capture d'écran ${i + 1} sur ${images.length} :`
    });
    parts.push({
      inline_data: {
        mime_type: img.mediaType || 'image/jpeg',
        data: img.data
      }
    });
  });

  parts.push({
    text: `Tu es un extracteur de données de paris sportifs. Analyse toutes les captures d'écran ci-dessus et extrait TOUS les matchs visibles dans l'ensemble des images, avec leurs cotes.

Pour chaque match retourne un objet JSON avec exactement ces champs :
- team1 : nom de l'équipe à gauche ou en haut (domicile)
- team2 : nom de l'équipe à droite ou en bas (extérieur)
- odd1 : cote victoire équipe 1 (nombre décimal, point comme séparateur)
- odd2 : cote match nul (nombre décimal, point comme séparateur)
- odd3 : cote victoire équipe 2 (nombre décimal, point comme séparateur)

Règles importantes :
- Si un même match apparaît dans plusieurs captures, ne le retourne qu'une seule fois.
- Retourne UNIQUEMENT un tableau JSON valide, sans texte avant ou après, sans markdown, sans backticks.
- Si aucun match n'est détecté sur aucune image, retourne un tableau vide : []

Exemple de format attendu :
[{"team1":"PSG","team2":"Lyon","odd1":1.85,"odd2":3.50,"odd3":4.20},{"team1":"Marseille","team2":"Nice","odd1":2.10,"odd2":3.20,"odd3":3.40}]`
  });

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2000
        }
      })
    });

    const data = await response.json();

    if (data.error) {
      return res.status(500).json({ error: data.error.message });
    }

    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleaned = rawText.replace(/```json|```/g, '').trim();

    let matches;
    try {
      matches = JSON.parse(cleaned);
    } catch {
      return res.status(500).json({ error: 'Réponse inattendue de l\'IA : ' + rawText.substring(0, 200) });
    }

    return res.status(200).json({ matches });

  } catch (err) {
    return res.status(500).json({ error: 'Erreur serveur : ' + err.message });
  }
}
