import Geometry from './Geometry'

export default class ShaderToy extends Geometry {
  constructor(gl: WebGL2RenderingContext) {
    super(gl)
    this._verts = [-1, -1, -1, 1, 1, -1, -1, 1, 1, 1, 1, -1]
    this._numVertComponents = 2
  }

  linkProgram(_program: WebGLShader) {
    this._buffers.push(this.gl.createBuffer())

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this._buffers[0])
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(this._verts), this.gl.STATIC_DRAW)
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null)

    const positionAttrib = {
      i_Position: {
        location: this.gl.getAttribLocation(_program, 'i_Position'),
        num_components: 2,
        type: this.gl.FLOAT,
        size: 4,
      },
    }
    this._VAOs.push(this.gl.createVertexArray())
    const VAODesc = [
      {
        vao: this._VAOs[0],
        buffers: [
          {
            buffer_object: this._buffers[0],
            stride: 0,
            attributes: positionAttrib,
          },
        ],
      },
    ]

    VAODesc.forEach((VAO) => this.setupVAO(VAO.buffers, VAO.vao))
  }
}
