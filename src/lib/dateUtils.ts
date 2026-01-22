export const getMonthBounds = (date: Date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  
  // Premier jour du mois "YYYY-MM-DD"
  const start = new Date(year, month, 1);
  // Dernier jour du mois
  const end = new Date(year, month + 1, 0);

  // Format ISO pour Firestore string comparison (YYYY-MM-DD)
  // Attention: un simple toISOString() convertit en UTC, ce qui peut décaler d'un jour selon les fuseaux.
  // On va faire un formatage local simple "YYYY-MM-DD".
  
  const formatDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  return {
    start: formatDate(start),
    end: `${formatDate(end)}T23:59:59`
  };
};

export const formatMonthYear = (date: Date) => {
  return date.toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
};
