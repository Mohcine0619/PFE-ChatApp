module.exports = (req, res, next) => {
  if (req.session.user) {
    next();
  } else {
    res.redirect('/auth/login');
  }
};
// Vérifie si l'objet session de la requête contient un utilisateur  et aller vers le middle suivant
