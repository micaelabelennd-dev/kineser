"""
Aplicación Flask con PostgreSQL en la nube (Neon)
Versión simplificada y lista para usar
"""
from flask import Flask, render_template, request, jsonify, session
from flask_sqlalchemy import SQLAlchemy
import bcrypt
import secrets
from functools import wraps
import os
from datetime import timedelta

app = Flask(__name__)

# ============================================================================
# CONFIGURACIÓN
# ============================================================================
# Base de datos PostgreSQL en Neon (ya configurada)
DATABASE_URL = os.environ.get('DATABASE_URL') or 'postgresql://neondb_owner:npg_T2Q6ZRHKxyFr@ep-purple-truth-ac29cb4n-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require'

# Si viene con postgres://, convertir
if DATABASE_URL.startswith('postgres://'):
    DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql://', 1)

app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY') or secrets.token_hex(32)
app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'pool_pre_ping': True,
    'pool_recycle': 300,
    'pool_size': 10,
    'max_overflow': 20,
    'connect_args': {
        'connect_timeout': 10,
        'sslmode': 'require'
    }
}

MAX_KINESIOLOGAS = int(os.environ.get('MAX_KINESIOLOGAS', 5))
max_pacientes_env = os.environ.get('MAX_PACIENTES', '1200')
MAX_PACIENTES = int(max_pacientes_env) if max_pacientes_env and max_pacientes_env != '' else None

app.config['SESSION_COOKIE_SECURE'] = os.environ.get('SESSION_COOKIE_SECURE', 'False').lower() == 'true'
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(seconds=int(os.environ.get('PERMANENT_SESSION_LIFETIME', 3600)))

db = SQLAlchemy(app)

# ============================================================================
# MODELOS
# ============================================================================

class Kinesiologa(db.Model):
    __tablename__ = 'kinesiologas'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=True)
    ejercicios = db.relationship('Ejercicio', backref='kinesiologa', lazy=True, cascade='all, delete-orphan')
    plantillas = db.relationship('EjercicioPlantilla', backref='kinesiologa', lazy=True, cascade='all, delete-orphan')

class Paciente(db.Model):
    __tablename__ = 'pacientes'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), unique=True, nullable=False, index=True)
    ejercicios = db.relationship('Ejercicio', backref='paciente', lazy=True, cascade='all, delete-orphan')

class EjercicioPlantilla(db.Model):
    __tablename__ = 'ejercicios_plantilla'
    id = db.Column(db.Integer, primary_key=True)
    kinesiologa_id = db.Column(db.Integer, db.ForeignKey('kinesiologas.id', ondelete='CASCADE'), nullable=False, index=True)
    nombre_ejercicio = db.Column(db.String(200), nullable=False)
    modo_ejecucion = db.Column(db.String(500), nullable=False)
    repeticiones = db.Column(db.Integer, nullable=False)
    series = db.Column(db.Integer, nullable=False)
    fecha_creacion = db.Column(db.TIMESTAMP, server_default=db.func.current_timestamp())
    __table_args__ = (db.UniqueConstraint('kinesiologa_id', 'nombre_ejercicio', name='uq_kinesiologa_nombre'),)

class Ejercicio(db.Model):
    __tablename__ = 'ejercicios'
    id = db.Column(db.Integer, primary_key=True)
    paciente_id = db.Column(db.Integer, db.ForeignKey('pacientes.id', ondelete='CASCADE'), nullable=False, index=True)
    kinesiologa_id = db.Column(db.Integer, db.ForeignKey('kinesiologas.id', ondelete='CASCADE'), nullable=False, index=True)
    plantilla_id = db.Column(db.Integer, db.ForeignKey('ejercicios_plantilla.id', ondelete='SET NULL'), nullable=True)
    nombre_ejercicio = db.Column(db.String(200), nullable=False)
    modo_ejecucion = db.Column(db.String(500), nullable=False)
    repeticiones = db.Column(db.Integer, nullable=False)
    series = db.Column(db.Integer, nullable=False)
    fecha_asignacion = db.Column(db.TIMESTAMP, server_default=db.func.current_timestamp())

# ============================================================================
# FUNCIONES DE SEGURIDAD
# ============================================================================

def hash_password(password):
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(password, password_hash):
    try:
        return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))
    except Exception:
        return False

def requiere_kinesiologa(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'kinesiologa_id' not in session:
            return jsonify({'error': 'No autorizado. Debe iniciar sesión como kinesióloga.'}), 401
        return f(*args, **kwargs)
    return decorated_function

# ============================================================================
# INICIALIZACIÓN
# ============================================================================

def init_db():
    with app.app_context():
        db.create_all()
        print("✅ Base de datos inicializada correctamente")

init_db()

# ============================================================================
# RUTAS
# ============================================================================

@app.route('/')
def index():
    kinesiologa_nombre = session.get('kinesiologa_nombre')
    return render_template('index.html', kinesiologa_autenticada=kinesiologa_nombre)

@app.route('/verificar_sesion', methods=['GET'])
def verificar_sesion():
    if 'kinesiologa_id' in session:
        return jsonify({
            'autenticada': True,
            'tipo': 'kinesiologa',
            'nombre': session.get('kinesiologa_nombre')
        })
    return jsonify({'autenticada': False})

@app.route('/registro_paciente', methods=['POST'])
def registro_paciente():
    data = request.get_json()
    nombre = data.get('nombre')
    if not nombre:
        return jsonify({'error': 'Falta el nombre'}), 400
    if len(nombre) > 100:
        return jsonify({'error': 'El nombre es demasiado largo (máximo 100 caracteres)'}), 400
    if len(nombre.strip()) == 0:
        return jsonify({'error': 'El nombre no puede estar vacío'}), 400

    try:
        if MAX_PACIENTES is not None:
            cantidad_actual = Paciente.query.count()
            if cantidad_actual >= MAX_PACIENTES:
                return jsonify({
                    'error': f'Se ha alcanzado el límite máximo de {MAX_PACIENTES} paciente(s) registrado(s).'
                }), 403
        
        paciente = Paciente.query.filter_by(nombre=nombre.strip()).first()
        if not paciente:
            paciente = Paciente(nombre=nombre.strip())
            db.session.add(paciente)
            db.session.commit()
        
        return jsonify({'id': paciente.id, 'nombre': paciente.nombre})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/registro_kinesiologa', methods=['POST'])
def registro_kinesiologa():
    data = request.get_json()
    nombre = data.get('nombre')
    password = data.get('password')
    
    if not nombre or not password:
        return jsonify({'error': 'Faltan nombre o contraseña'}), 400
    if len(nombre) > 100:
        return jsonify({'error': 'El nombre es demasiado largo (máximo 100 caracteres)'}), 400
    if len(nombre.strip()) == 0:
        return jsonify({'error': 'El nombre no puede estar vacío'}), 400
    if len(password) < 4:
        return jsonify({'error': 'La contraseña debe tener al menos 4 caracteres'}), 400
    if len(password) > 200:
        return jsonify({'error': 'La contraseña es demasiado larga (máximo 200 caracteres)'}), 400

    try:
        cantidad_actual = Kinesiologa.query.count()
        if cantidad_actual >= MAX_KINESIOLOGAS:
            return jsonify({
                'error': f'Se ha alcanzado el límite máximo de {MAX_KINESIOLOGAS} kinesióloga(s) registrada(s).'
            }), 403
        
        if Kinesiologa.query.filter_by(nombre=nombre.strip()).first():
            return jsonify({'error': 'Ya existe una kinesióloga con ese nombre'}), 400
        
        password_hash = hash_password(password)
        kinesiologa = Kinesiologa(nombre=nombre.strip(), password_hash=password_hash)
        db.session.add(kinesiologa)
        db.session.commit()
        
        return jsonify({
            'id': kinesiologa.id, 
            'nombre': kinesiologa.nombre, 
            'mensaje': 'Kinesióloga registrada exitosamente',
            'kinesiologas_registradas': cantidad_actual + 1,
            'limite': MAX_KINESIOLOGAS
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/login_kinesiologa', methods=['POST'])
def login_kinesiologa():
    data = request.get_json()
    nombre = data.get('nombre')
    password = data.get('password')
    
    if not nombre or not password:
        return jsonify({'error': 'Faltan nombre o contraseña'}), 400
    if len(nombre) > 100 or len(password) > 200:
        return jsonify({'error': 'Datos inválidos'}), 400

    try:
        kinesiologa = Kinesiologa.query.filter_by(nombre=nombre.strip()).first()
        if not kinesiologa:
            return jsonify({'error': 'Kinesióloga no encontrada'}), 404
        
        if not kinesiologa.password_hash or not verify_password(password, kinesiologa.password_hash):
            return jsonify({'error': 'Contraseña incorrecta'}), 401
        
        session['kinesiologa_id'] = kinesiologa.id
        session['kinesiologa_nombre'] = kinesiologa.nombre
        session.permanent = True
        
        return jsonify({'id': kinesiologa.id, 'nombre': kinesiologa.nombre, 'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True, 'mensaje': 'Sesión cerrada'})

@app.route('/pacientes/<kinesiologa>', methods=['GET'])
@requiere_kinesiologa
def obtener_pacientes(kinesiologa):
    try:
        kin = Kinesiologa.query.filter_by(nombre=kinesiologa).first()
        if not kin:
            return jsonify({'error': 'Kinesiologa no encontrada'}), 404
        if session.get('kinesiologa_id') != kin.id:
            return jsonify({'error': 'No autorizado'}), 403
        
        pacientes = Paciente.query.order_by(Paciente.nombre).all()
        return jsonify([{'nombre': p.nombre} for p in pacientes])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/plantillas/<kinesiologa>', methods=['GET'])
@requiere_kinesiologa
def obtener_plantillas(kinesiologa):
    try:
        kin = Kinesiologa.query.filter_by(nombre=kinesiologa).first()
        if not kin:
            return jsonify({'error': 'Kinesiologa no encontrada'}), 404
        if session.get('kinesiologa_id') != kin.id:
            return jsonify({'error': 'No autorizado'}), 403
        
        plantillas = EjercicioPlantilla.query.filter_by(kinesiologa_id=kin.id).order_by(EjercicioPlantilla.fecha_creacion.desc()).all()
        return jsonify([{
            'id': p.id,
            'nombre_ejercicio': p.nombre_ejercicio,
            'modo_ejecucion': p.modo_ejecucion,
            'repeticiones': p.repeticiones,
            'series': p.series,
            'fecha_creacion': p.fecha_creacion.isoformat() if p.fecha_creacion else None
        } for p in plantillas])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/ejercicio', methods=['POST'])
@requiere_kinesiologa
def agregar_ejercicio():
    data = request.get_json()
    kinesiologa = data.get('kinesiologa')
    paciente = data.get('paciente')
    nombre_ejercicio = data.get('nombre_ejercicio')
    modo_ejecucion = data.get('modo_ejecucion')
    repeticiones = data.get('repeticiones')
    series = data.get('series')

    if not all([kinesiologa, paciente, nombre_ejercicio, modo_ejecucion, repeticiones, series]):
        return jsonify({'error': 'Faltan datos'}), 400

    try:
        kin = Kinesiologa.query.filter_by(nombre=kinesiologa).first()
        if not kin:
            return jsonify({'error': 'Kinesiologa no encontrada'}), 404
        if session.get('kinesiologa_id') != kin.id:
            return jsonify({'error': 'No autorizado'}), 403

        pac = Paciente.query.filter_by(nombre=paciente).first()
        if not pac:
            return jsonify({'error': 'Paciente no encontrado'}), 404

        plantilla = EjercicioPlantilla.query.filter_by(
            kinesiologa_id=kin.id,
            nombre_ejercicio=nombre_ejercicio,
            modo_ejecucion=modo_ejecucion,
            repeticiones=repeticiones,
            series=series
        ).first()
        
        if not plantilla:
            try:
                plantilla = EjercicioPlantilla(
                    kinesiologa_id=kin.id,
                    nombre_ejercicio=nombre_ejercicio.strip(),
                    modo_ejecucion=modo_ejecucion.strip(),
                    repeticiones=repeticiones,
                    series=series
                )
                db.session.add(plantilla)
                db.session.flush()
            except Exception:
                plantilla = EjercicioPlantilla.query.filter_by(
                    kinesiologa_id=kin.id,
                    nombre_ejercicio=nombre_ejercicio.strip()
                ).first()
                if not plantilla:
                    return jsonify({'error': 'No se pudo obtener plantilla existente'}), 500

        if not isinstance(repeticiones, int) or repeticiones < 1 or repeticiones > 1000:
            return jsonify({'error': 'Las repeticiones deben ser un número entre 1 y 1000'}), 400
        if not isinstance(series, int) or series < 1 or series > 100:
            return jsonify({'error': 'Las series deben ser un número entre 1 y 100'}), 400
        if len(nombre_ejercicio.strip()) == 0 or len(modo_ejecucion.strip()) == 0:
            return jsonify({'error': 'El nombre y modo de ejecución no pueden estar vacíos'}), 400
        if len(nombre_ejercicio.strip()) > 200:
            return jsonify({'error': 'El nombre del ejercicio es demasiado largo (máximo 200 caracteres)'}), 400
        if len(modo_ejecucion.strip()) > 500:
            return jsonify({'error': 'El modo de ejecución es demasiado largo (máximo 500 caracteres)'}), 400

        ejercicio = Ejercicio(
            paciente_id=pac.id,
            kinesiologa_id=kin.id,
            plantilla_id=plantilla.id,
            nombre_ejercicio=nombre_ejercicio.strip(),
            modo_ejecucion=modo_ejecucion.strip(),
            repeticiones=repeticiones,
            series=series
        )
        db.session.add(ejercicio)
        db.session.commit()
        
        return jsonify({'success': True, 'plantilla_id': plantilla.id})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/asignar_plantilla', methods=['POST'])
@requiere_kinesiologa
def asignar_plantilla():
    data = request.get_json()
    kinesiologa = data.get('kinesiologa')
    paciente = data.get('paciente')
    plantilla_id = data.get('plantilla_id')

    if not all([kinesiologa, paciente, plantilla_id]):
        return jsonify({'error': 'Faltan datos'}), 400
    if not isinstance(plantilla_id, int) or plantilla_id < 1:
        return jsonify({'error': 'ID de plantilla inválido'}), 400

    try:
        kin = Kinesiologa.query.filter_by(nombre=kinesiologa.strip()).first()
        if not kin:
            return jsonify({'error': 'Kinesiologa no encontrada'}), 404
        if session.get('kinesiologa_id') != kin.id:
            return jsonify({'error': 'No autorizado'}), 403
        
        pac = Paciente.query.filter_by(nombre=paciente.strip()).first()
        if not pac:
            return jsonify({'error': 'Paciente no encontrado'}), 404
        
        plantilla = EjercicioPlantilla.query.filter_by(id=plantilla_id, kinesiologa_id=kin.id).first()
        if not plantilla:
            return jsonify({'error': 'Plantilla no encontrada o no pertenece a esta kinesiologa'}), 404

        ejercicio = Ejercicio(
            paciente_id=pac.id,
            kinesiologa_id=kin.id,
            plantilla_id=plantilla.id,
            nombre_ejercicio=plantilla.nombre_ejercicio,
            modo_ejecucion=plantilla.modo_ejecucion,
            repeticiones=plantilla.repeticiones,
            series=plantilla.series
        )
        db.session.add(ejercicio)
        db.session.commit()
        
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/ejercicios/<paciente>', methods=['GET'])
def obtener_ejercicios(paciente):
    if not paciente or len(paciente.strip()) == 0:
        return jsonify({'error': 'Nombre de paciente inválido'}), 400
    
    try:
        pac = Paciente.query.filter_by(nombre=paciente.strip()).first()
        if not pac:
            return jsonify({'error': 'Paciente no encontrado'}), 404
        
        ejercicios = Ejercicio.query.filter_by(paciente_id=pac.id).order_by(Ejercicio.fecha_asignacion.desc()).all()
        return jsonify([{
            'id': e.id,
            'nombre_ejercicio': e.nombre_ejercicio,
            'modo_ejecucion': e.modo_ejecucion,
            'repeticiones': e.repeticiones,
            'series': e.series,
            'fecha_asignacion': e.fecha_asignacion.isoformat() if e.fecha_asignacion else None
        } for e in ejercicios])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/ejercicio/<int:ejercicio_id>', methods=['PUT'])
@requiere_kinesiologa
def modificar_ejercicio(ejercicio_id):
    data = request.get_json()
    nombre_ejercicio = data.get('nombre_ejercicio')
    modo_ejecucion = data.get('modo_ejecucion')
    repeticiones = data.get('repeticiones')
    series = data.get('series')

    if not all([nombre_ejercicio, modo_ejecucion, repeticiones, series]):
        return jsonify({'error': 'Faltan datos'}), 400
    
    if not isinstance(repeticiones, int) or repeticiones < 1 or repeticiones > 1000:
        return jsonify({'error': 'Las repeticiones deben ser un número entre 1 y 1000'}), 400
    if not isinstance(series, int) or series < 1 or series > 100:
        return jsonify({'error': 'Las series deben ser un número entre 1 y 100'}), 400
    if len(nombre_ejercicio.strip()) == 0 or len(modo_ejecucion.strip()) == 0:
        return jsonify({'error': 'El nombre y modo de ejecución no pueden estar vacíos'}), 400
    if len(nombre_ejercicio.strip()) > 200:
        return jsonify({'error': 'El nombre del ejercicio es demasiado largo (máximo 200 caracteres)'}), 400
    if len(modo_ejecucion.strip()) > 500:
        return jsonify({'error': 'El modo de ejecución es demasiado largo (máximo 500 caracteres)'}), 400

    try:
        ejercicio = Ejercicio.query.get(ejercicio_id)
        if not ejercicio:
            return jsonify({'error': 'Ejercicio no encontrado'}), 404
        if session.get('kinesiologa_id') != ejercicio.kinesiologa_id:
            return jsonify({'error': 'No autorizado. Este ejercicio no pertenece a su cuenta.'}), 403
        
        ejercicio.nombre_ejercicio = nombre_ejercicio.strip()
        ejercicio.modo_ejecucion = modo_ejecucion.strip()
        ejercicio.repeticiones = repeticiones
        ejercicio.series = series
        db.session.commit()
        
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/plantilla/<int:plantilla_id>', methods=['PUT'])
@requiere_kinesiologa
def modificar_plantilla(plantilla_id):
    data = request.get_json()
    nombre_ejercicio = data.get('nombre_ejercicio')
    modo_ejecucion = data.get('modo_ejecucion')
    repeticiones = data.get('repeticiones')
    series = data.get('series')

    if not all([nombre_ejercicio, modo_ejecucion, repeticiones, series]):
        return jsonify({'error': 'Faltan datos'}), 400
    
    if not isinstance(repeticiones, int) or repeticiones < 1 or repeticiones > 1000:
        return jsonify({'error': 'Las repeticiones deben ser un número entre 1 y 1000'}), 400
    if not isinstance(series, int) or series < 1 or series > 100:
        return jsonify({'error': 'Las series deben ser un número entre 1 y 100'}), 400
    if len(nombre_ejercicio.strip()) == 0 or len(modo_ejecucion.strip()) == 0:
        return jsonify({'error': 'El nombre y modo de ejecución no pueden estar vacíos'}), 400
    if len(nombre_ejercicio.strip()) > 200:
        return jsonify({'error': 'El nombre del ejercicio es demasiado largo (máximo 200 caracteres)'}), 400
    if len(modo_ejecucion.strip()) > 500:
        return jsonify({'error': 'El modo de ejecución es demasiado largo (máximo 500 caracteres)'}), 400

    try:
        plantilla = EjercicioPlantilla.query.get(plantilla_id)
        if not plantilla:
            return jsonify({'error': 'Plantilla no encontrada'}), 404
        if session.get('kinesiologa_id') != plantilla.kinesiologa_id:
            return jsonify({'error': 'No autorizado. Esta plantilla no pertenece a su cuenta.'}), 403
        
        plantilla.nombre_ejercicio = nombre_ejercicio.strip()
        plantilla.modo_ejecucion = modo_ejecucion.strip()
        plantilla.repeticiones = repeticiones
        plantilla.series = series
        db.session.commit()
        
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/ejercicio/<int:ejercicio_id>', methods=['DELETE'])
@requiere_kinesiologa
def borrar_ejercicio(ejercicio_id):
    try:
        ejercicio = Ejercicio.query.get(ejercicio_id)
        if not ejercicio:
            return jsonify({'error': 'Ejercicio no encontrado'}), 404
        if session.get('kinesiologa_id') != ejercicio.kinesiologa_id:
            return jsonify({'error': 'No autorizado. Este ejercicio no pertenece a su cuenta.'}), 403
        
        db.session.delete(ejercicio)
        db.session.commit()
        
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/paciente/<nombre>', methods=['DELETE'])
@requiere_kinesiologa
def borrar_paciente(nombre):
    if not nombre or len(nombre.strip()) == 0:
        return jsonify({'error': 'Nombre de paciente inválido'}), 400
    
    try:
        paciente = Paciente.query.filter_by(nombre=nombre.strip()).first()
        if not paciente:
            return jsonify({'error': 'Paciente no encontrado'}), 404
        
        db.session.delete(paciente)
        db.session.commit()
        
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/gestionar/<kinesiologa>/<paciente>')
def gestionar_paciente(kinesiologa, paciente):
    if 'kinesiologa_id' not in session or session.get('kinesiologa_nombre') != kinesiologa:
        return render_template('error.html', mensaje='Debe iniciar sesión como kinesióloga para acceder a esta página'), 403
    return render_template('gestionar.html', kinesiologa=kinesiologa, paciente=paciente)

@app.route('/gestionar_plantillas/<kinesiologa>')
def gestionar_plantillas(kinesiologa):
    if 'kinesiologa_id' not in session or session.get('kinesiologa_nombre') != kinesiologa:
        return render_template('error.html', mensaje='Debe iniciar sesión como kinesióloga para acceder a esta página'), 403
    return render_template('gestionar_plantillas.html', kinesiologa=kinesiologa)

@app.route('/crear_plantilla', methods=['POST'])
@requiere_kinesiologa
def crear_plantilla():
    data = request.get_json()
    kinesiologa = data.get('kinesiologa')
    nombre_ejercicio = data.get('nombre_ejercicio')
    modo_ejecucion = data.get('modo_ejecucion')
    repeticiones = data.get('repeticiones')
    series = data.get('series')
    
    if not all([kinesiologa, nombre_ejercicio, modo_ejecucion, repeticiones, series]):
        return jsonify({'error': 'Faltan datos'}), 400
    
    if not isinstance(repeticiones, int) or repeticiones < 1 or repeticiones > 1000:
        return jsonify({'error': 'Las repeticiones deben ser un número entre 1 y 1000'}), 400
    if not isinstance(series, int) or series < 1 or series > 100:
        return jsonify({'error': 'Las series deben ser un número entre 1 y 100'}), 400
    if len(nombre_ejercicio.strip()) == 0 or len(modo_ejecucion.strip()) == 0:
        return jsonify({'error': 'El nombre y modo de ejecución no pueden estar vacíos'}), 400
    if len(nombre_ejercicio.strip()) > 200:
        return jsonify({'error': 'El nombre del ejercicio es demasiado largo (máximo 200 caracteres)'}), 400
    if len(modo_ejecucion.strip()) > 500:
        return jsonify({'error': 'El modo de ejecución es demasiado largo (máximo 500 caracteres)'}), 400

    try:
        kin = Kinesiologa.query.filter_by(nombre=kinesiologa).first()
        if not kin:
            return jsonify({'error': 'Kinesiologa no encontrada'}), 404
        if session.get('kinesiologa_id') != kin.id:
            return jsonify({'error': 'No autorizado'}), 403
        
        if EjercicioPlantilla.query.filter_by(kinesiologa_id=kin.id, nombre_ejercicio=nombre_ejercicio.strip()).first():
            return jsonify({'error': 'Ya existe una plantilla con ese nombre para esta kinesióloga'}), 400
        
        plantilla = EjercicioPlantilla(
            kinesiologa_id=kin.id,
            nombre_ejercicio=nombre_ejercicio.strip(),
            modo_ejecucion=modo_ejecucion.strip(),
            repeticiones=repeticiones,
            series=series
        )
        db.session.add(plantilla)
        db.session.commit()
        
        return jsonify({'success': True, 'plantilla_id': plantilla.id})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/plantilla/<int:plantilla_id>', methods=['DELETE'])
@requiere_kinesiologa
def eliminar_plantilla(plantilla_id):
    try:
        plantilla = EjercicioPlantilla.query.get(plantilla_id)
        if not plantilla:
            return jsonify({'error': 'Plantilla no encontrada'}), 404
        if session.get('kinesiologa_id') != plantilla.kinesiologa_id:
            return jsonify({'error': 'No autorizado'}), 403
        
        db.session.delete(plantilla)
        db.session.commit()
        
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/admin/kinesiologas', methods=['GET'])
@requiere_kinesiologa
def listar_kinesiologas():
    try:
        kinesiologas = Kinesiologa.query.order_by(Kinesiologa.nombre).all()
        return jsonify({
            'kinesiologas': [{'id': k.id, 'nombre': k.nombre} for k in kinesiologas],
            'total': len(kinesiologas),
            'limite': MAX_KINESIOLOGAS
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/admin/kinesiologa/<int:kinesiologa_id>', methods=['DELETE'])
@requiere_kinesiologa
def eliminar_kinesiologa(kinesiologa_id):
    if session.get('kinesiologa_id') == kinesiologa_id:
        return jsonify({'error': 'No puede eliminar su propia cuenta'}), 400
    
    try:
        kinesiologa = Kinesiologa.query.get(kinesiologa_id)
        if not kinesiologa:
            return jsonify({'error': 'Kinesióloga no encontrada'}), 404
        
        nombre_kinesiologa = kinesiologa.nombre
        db.session.delete(kinesiologa)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'mensaje': f'Kinesióloga "{nombre_kinesiologa}" eliminada exitosamente'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/cambiar_password', methods=['POST'])
@requiere_kinesiologa
def cambiar_password():
    data = request.get_json()
    kinesiologa = session.get('kinesiologa_nombre')
    password_actual = data.get('password_actual')
    password_nuevo = data.get('password_nuevo')
    
    if not kinesiologa or not password_actual or not password_nuevo:
        return jsonify({'error': 'Faltan datos'}), 400
    if len(password_nuevo) < 4:
        return jsonify({'error': 'La contraseña debe tener al menos 4 caracteres'}), 400
    
    try:
        kin = Kinesiologa.query.filter_by(nombre=kinesiologa).first()
        if not kin or not verify_password(password_actual, kin.password_hash):
            return jsonify({'error': 'Contraseña actual incorrecta'}), 401
        
        kin.password_hash = hash_password(password_nuevo)
        db.session.commit()
        
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=False, host='0.0.0.0', port=port)
