const SPHERE_VARIANTS = ['large', 'medium', 'small', 'tiny']

const Spheres = () => (
    <div className="login-spheres absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        {SPHERE_VARIANTS.map((variant) => (
            <span key={variant} className={`login-sphere login-sphere--${variant}`} />
        ))}
    </div>
)

export default Spheres