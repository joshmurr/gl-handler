import LA_Trance from './LA_trance.mp3'
import { GL_Handler, ShaderToy, Types as T } from 'gl-handler'

const vert = `#version 300 es
precision mediump float;

in vec3 i_Position;

void main(){
  gl_Position = vec4(i_Position, 1.0);
}`

const outputFrag = `#version 300 es
precision mediump float;

uniform vec2 u_resolution;
uniform sampler2D u_audioData;
out vec4 OUTCOLOUR;

void main(){
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float fft = texture2D(audioData, vec2(uv.x * 0.25, 0)).r;
  OUTCOLOUR = vec4(uv * pow(fft, 5.0), 0, 1);
}`

const G = new GL_Handler()
G.canvas(512, 512)
const gl = G.gl
const program = G.shaderProgram(vert, outputFrag)

const shaderToy = new ShaderToy(gl)
shaderToy.linkProgram(program)

function start() {
  const context = new AudioContext()
  const analyser = context.createAnalyser()

  // Make a buffer to receive the audio data
  const numPoints = analyser.frequencyBinCount
  const audioDataArray = new Uint8Array(numPoints)

  const audioTex = G.createTexture(numPoints, 1, { type: 'LUMINANCE', filter: 'NEAREST', wrap: 'CLAMP_TO_EDGE' })

  // UNIFORMS ---------------------------
  const baseUniforms: T.UniformDescs = {
    u_resolution: [gl.canvas.width, gl.canvas.height],
  }
  const uniformSetters = G.getUniformSetters(program)
  // ------------------------------------

  // AUDIO ------------------------------
  // Make a audio node
  const audio = new Audio()
  audio.loop = true
  audio.autoplay = true
  // call `handleCanplay` when it music can be played
  audio.addEventListener('canplay', handleCanplay)
  audio.src = LA_Trance
  audio.load()

  function handleCanplay() {
    // connect the audio element to the analyser node and the analyser node
    // to the main Web Audio context
    const source = context.createMediaElementSource(audio)
    source.connect(analyser)
    analyser.connect(context.destination)
  }
  // ------------------------------------

  function draw() {
    gl.useProgram(program)
    gl.bindVertexArray(shaderToy.VAO)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    gl.clearColor(0.9, 0.9, 0.9, 1)

    // get the current audio data
    analyser.getByteFrequencyData(audioDataArray)
    gl.bindTexture(gl.TEXTURE_2D, audioTex)
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0, // level
      0, // x
      0, // y
      numPoints, // width
      1, // height
      gl.LUMINANCE, // format
      gl.UNSIGNED_BYTE, // type
      audioDataArray,
    )

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
    G.setUniforms(uniformSetters, { ...baseUniforms, u_audioData: audioTex })
    gl.drawArrays(gl.TRIANGLES, 0, shaderToy.numVertices)

    gl.bindVertexArray(null)
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null)

    requestAnimationFrame(draw)
  }
}
