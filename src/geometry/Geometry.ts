import { vec3, mat4 } from 'gl-matrix'

import { BufferDesc, RotationDesc, UniformDesc } from '../types'

export default abstract class Geometry {
  gl: WebGL2RenderingContext

  _indexedGeometry = false
  _uniformsNeedsUpdate = false
  _translate: [number, number, number] = [0.0, 0.0, 0.0]
  _rotation: RotationDesc = { speed: 0, angle: 0, axis: [0, 0, 0] }
  _oscillate = false
  _animate = false

  _verts: number[]
  _numVertComponents: number
  _indices: number[]
  _normals: number[]
  _colors: number[]
  _texCoords: number[]
  _buffers: WebGLBuffer[] = []
  _VAOs: WebGLVertexArrayObject[] = []

  _modelMatrix = mat4.create()

  _uniforms: { [key: string]: UniformDesc<Float32Array | number | mat4> } = {}
  _textures = {}

  _centroid: [number, number, number]

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl
  }

  protected abstract linkProgram(_program: WebGLProgram, _renderProgram?: WebGLProgram): void

  destroy() {
    this._buffers.forEach((buf) => this.gl.deleteBuffer(buf))
    /* this._VAOs.forEach((VAO) => this.gl.deleteVertexArray(VAO)) */
  }

  public setupVAO(_buffers: BufferDesc[], _VAO: WebGLVertexArrayObject) {
    this.gl.bindVertexArray(_VAO)

    _buffers.map((buffer) => {
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer.buffer_object)
      let offset = 0

      /* let attrib: keyof AllAttribDesc */
      for (const attribDesc of Object.values(buffer.attributes)) {
        /* const attribDesc = buffer.attributes[attrib] */
        if (attribDesc.location < 0) continue
        this.gl.enableVertexAttribArray(attribDesc.location)
        this.gl.vertexAttribPointer(
          attribDesc.location,
          attribDesc.num_components,
          attribDesc.type,
          false, // normalize
          buffer.stride,
          offset,
        )
        offset += attribDesc.num_components * attribDesc.size
        if (attribDesc.divisor) {
          this.gl.vertexAttribDivisor(attribDesc.location, attribDesc.divisor)
        }
      }
    })
    if (this._indexedGeometry) {
      const indexBuffer = this.gl.createBuffer()
      this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, indexBuffer)
      this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(this._indices), this.gl.STATIC_DRAW)
    }
    // Empty Buffers:
    // !Important to unbind the VAO first.
    this.gl.bindVertexArray(null)
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null)
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, null)
  }

  public get VAO() {
    return this._VAOs[0]
  }

  public get numVertices() {
    return this._verts.length / (this._numVertComponents || 3)
  }

  public get verts() {
    return this._verts
  }

  public get numIndices() {
    return this._indices.length
  }

  public get buffers() {
    return this._buffers
  }

  public get translate() {
    return this._translate
  }

  set translate(loc) {
    this._uniformsNeedsUpdate = true
    this._translate[0] = loc[0]
    this._translate[1] = loc[1]
    this._translate[2] = loc[2]
  }

  public set rotate(speedAxis: RotationDesc) {
    this._uniformsNeedsUpdate = true
    const { speed, angle, axis } = speedAxis
    this._rotation.speed = speed
    this._rotation.angle = angle
    this._rotation.axis[0] = axis[0]
    this._rotation.axis[1] = axis[1]
    this._rotation.axis[2] = axis[2]
  }

  public set oscillate(val: boolean) {
    if (typeof val === 'boolean') this._oscillate = val
  }

  public set animate(val: boolean) {
    if (typeof val === 'boolean') this._animate = val
  }

  public get needsUpdate() {
    return this._uniformsNeedsUpdate
  }

  public updateModelMatrix(_time: number) {
    mat4.identity(this._modelMatrix)
    const translation = vec3.fromValues(...this._translate)
    mat4.translate(this._modelMatrix, this._modelMatrix, translation)
    const angle = this._animate
      ? (this._oscillate ? Math.sin(_time * 0.001) * 90 : _time) * this._rotation.speed
      : this._rotation.angle
    mat4.rotate(this._modelMatrix, this._modelMatrix, angle, this._rotation.axis)

    return this._modelMatrix
  }

  public updateInverseModelMatrix() {
    mat4.invert(this._uniforms.u_InverseModelMatrix.value as mat4, this._uniforms.u_ModelMatrix.value as mat4)
  }

  public normalizeEachVert() {
    for (let i = 0; i < this._verts.length; i += 3) {
      const norm = this.normalizeFromArray(this._verts[i], this._verts[i + 1], this._verts[i + 2])
      this._verts[i] = norm[0]
      this._verts[i + 1] = norm[1]
      this._verts[i + 2] = norm[2]
    }
  }

  public normalizeVerts(_verts: number[]) {
    let min = Number.POSITIVE_INFINITY
    let max = Number.NEGATIVE_INFINITY
    const vectors: vec3[] = []
    for (let i = 0; i < _verts.length; i += 3) {
      const v = vec3.fromValues(_verts[i], _verts[i + 1], _verts[i + 2])
      vectors.push(v)
      const l = vec3.len(v)

      min = Math.min(l, min)
      max = Math.max(l, max)
    }
    const scale = 1 / max
    const newVerts = new Array<number>(_verts.length)
    for (let i = 0; i < vectors.length; i++) {
      const v = vectors[i]
      vec3.scale(v, v, scale)
      const j = i * 3
      newVerts[j] = v[0]
      newVerts[j + 1] = v[1]
      newVerts[j + 2] = v[2]
    }

    return newVerts
  }

  public normalize() {
    this._verts = this.normalizeVerts(this._verts)
  }

  private normalizeFromArray(a: number, b: number, c: number) {
    const len = Math.sqrt(a * a + b * b + c * c)
    return [a / len, b / len, c / len]
  }

  public centreVerts() {
    if (!this._centroid) this.calcCentroid()

    for (let i = 0; i < this._verts.length; i += 3) {
      this._verts[i] -= this._centroid[0]
      this._verts[i + 1] -= this._centroid[1]
      this._verts[i + 2] -= this._centroid[2]
    }
  }

  private calcCentroid() {
    let xs = 0
    let ys = 0
    let zs = 0

    for (let i = 0; i < this._verts.length; i += 3) {
      xs += this._verts[i]
      ys += this._verts[i + 1]
      zs += this._verts[i + 2]
    }

    xs /= this._verts.length / 3
    ys /= this._verts.length / 3
    zs /= this._verts.length / 3

    this._centroid = [xs, ys, zs]
  }

  protected calcIndices(): number[] {
    const indices: number[] = []
    for (let i = 0; i < this._verts.length; i += 3) {
      const idx = i / 3
      if (idx > 1) indices.push(idx - 1)
      indices.push(idx)
    }
    return indices
  }
}
