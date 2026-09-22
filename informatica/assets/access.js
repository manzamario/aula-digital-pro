(function enforceClassAccess() {
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const informaticaIndex = pathParts.lastIndexOf('informatica');
    const isSubpage = informaticaIndex >= 0 && pathParts.length > informaticaIndex + 2;
    const platformPath = isSubpage ? '../../index.html' : '../index.html';

    try {
        const session = JSON.parse(sessionStorage.getItem('aulaSession') || 'null');
        const hasClassAccess = session && session.role === 'alumno' && Number(session.classAccessExpiresAt) > Date.now();
        const staffAccess = session && (session.role === 'docente' || session.role === 'admin');

        if (!hasClassAccess && !staffAccess) {
            window.location.replace(platformPath);
        }
    } catch (error) {
        window.location.replace(platformPath);
    }
})();
